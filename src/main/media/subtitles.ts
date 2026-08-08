import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, extname, join, parse } from 'node:path'
import { promisify } from 'node:util'
import type { ListSubtitlesOptions, SubtitleTrack } from '../../shared/types/media'

const supportedSubtitleExtensions = new Set(['.vtt', '.srt', '.ass', '.ssa'])
const extractableEmbeddedSubtitleCodecs = new Set([
  'ass',
  'ssa',
  'subrip',
  'text',
  'webvtt',
  'mov_text'
])
const languageNames = new Intl.DisplayNames(['en'], { type: 'language' })
const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

type FfprobeSubtitleStream = {
  index?: number
  codec_name?: string
  tags?: {
    language?: string
    title?: string
  }
}

type FfprobeSubtitleResult = {
  streams?: FfprobeSubtitleStream[]
}

function getOptionalPackageExport(packageName: string): unknown {
  try {
    return require(packageName)
  } catch {
    return null
  }
}

function getFfmpegStaticPath(): string | null {
  const ffmpegPath = getOptionalPackageExport('ffmpeg-static')

  return typeof ffmpegPath === 'string' && ffmpegPath ? normalizeExecutablePath(ffmpegPath) : null
}

function getFfprobeStaticPath(): string | null {
  const ffprobeStatic = getOptionalPackageExport('ffprobe-static')

  if (
    ffprobeStatic &&
    typeof ffprobeStatic === 'object' &&
    'path' in ffprobeStatic &&
    typeof ffprobeStatic.path === 'string'
  ) {
    return normalizeExecutablePath(ffprobeStatic.path)
  }

  return null
}

function normalizeExecutablePath(executablePath: string): string {
  return executablePath.replace('app.asar', 'app.asar.unpacked')
}

function getSubtitleLabel(videoStem: string, subtitlePath: string): string {
  const parsed = parse(subtitlePath)
  const suffix = parsed.name.slice(videoStem.length).replace(/^[.\s_-]+/, '')

  if (!suffix) return 'Default'

  try {
    return languageNames.of(suffix) ?? suffix.toUpperCase()
  } catch {
    return suffix.toUpperCase()
  }
}

function normalizeSubtitleText(content: string): string {
  return content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

function convertSrtToVtt(content: string): string {
  const blocks = normalizeSubtitleText(content)
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)

  const cues = blocks
    .map((block) => {
      const lines = block.split('\n')
      const cueLines = /^\d+$/.test(lines[0]?.trim() ?? '') ? lines.slice(1) : lines

      return cueLines
        .join('\n')
        .replace(
          /(\d{2}:\d{2}:\d{2}),(\d{3})\s+-->\s+(\d{2}:\d{2}:\d{2}),(\d{3})/g,
          '$1.$2 --> $3.$4'
        )
    })
    .filter((cue) => cue.includes('-->'))

  return `WEBVTT\n\n${cues.join('\n\n')}\n`
}

function parseAssTimestamp(value: string): number | null {
  const match = value.trim().match(/^(\d+):(\d{2}):(\d{2})[.](\d{1,2})$/)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const centiseconds = Number(match[4].padEnd(2, '0'))

  return hours * 3600 + minutes * 60 + seconds + centiseconds / 100
}

function formatVttTimestamp(seconds: number): string {
  const milliseconds = Math.max(Math.round(seconds * 1000), 0)
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000)
  const wholeSeconds = Math.floor((milliseconds % 60_000) / 1000)
  const remainingMilliseconds = milliseconds % 1000

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    wholeSeconds
  ).padStart(2, '0')}.${String(remainingMilliseconds).padStart(3, '0')}`
}

function splitAssCsvLine(value: string, fieldCount: number): string[] {
  const fields = value.split(',')
  if (fields.length <= fieldCount) return fields

  return [...fields.slice(0, fieldCount - 1), fields.slice(fieldCount - 1).join(',')]
}

function isDecorativeAssStyle(value: string): boolean {
  return /\b(signs?|songs?|karaoke|lyrics?|op|ed|opening|ending|ncop|nced|typeset|ts)\b/i.test(
    value
  )
}

function stripAssOverrideTags(value: string): string {
  return value.replace(/\{[^}]*\}/g, '')
}

function hasAssDrawingOverride(value: string): boolean {
  return /\\p[1-9]/i.test(value)
}

function hasAssKaraokeOverride(value: string): boolean {
  return /\\k[fo]?\d+/i.test(value)
}

function isLikelyAssDrawingText(value: string): boolean {
  const normalizedValue = value.replace(/\s+/g, ' ').trim().toLowerCase()
  if (!normalizedValue) return false

  const tokens = normalizedValue.split(' ')
  const numericTokens = tokens.filter((token) => /^-?\d+(?:\.\d+)?$/.test(token)).length
  const drawingCommandTokens = tokens.filter((token) => /^(m|n|l|b|s|p|c)$/.test(token)).length
  const wordTokens = tokens.filter(
    (token) => /[a-z]/.test(token) && !/^(m|n|l|b|s|p|c)$/.test(token)
  ).length

  return (
    tokens.length >= 8 &&
    numericTokens >= 6 &&
    drawingCommandTokens > 0 &&
    wordTokens === 0 &&
    numericTokens / tokens.length > 0.55
  )
}

function cleanAssDialogueText(value: string): string {
  return stripAssOverrideTags(value)
    .replace(/\\N/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\h/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
    .trim()
}

function escapeVttText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/-->/g, '--&gt;')
}

function convertAssToPlainVtt(content: string): string {
  const lines = normalizeSubtitleText(content).split('\n')
  let isInEvents = false
  let eventFields: string[] = []
  const cues: Array<{ start: number; end: number; text: string }> = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    if (/^\[events\]$/i.test(trimmedLine)) {
      isInEvents = true
      continue
    }
    if (/^\[[^\]]+\]$/.test(trimmedLine)) {
      isInEvents = false
      continue
    }
    if (!isInEvents) continue

    if (/^format\s*:/i.test(trimmedLine)) {
      eventFields = trimmedLine
        .replace(/^format\s*:/i, '')
        .split(',')
        .map((field) => field.trim().toLowerCase())
      continue
    }

    const eventMatch = trimmedLine.match(/^(dialogue|comment)\s*:\s*(.*)$/i)
    if (!eventMatch || eventMatch[1].toLowerCase() !== 'dialogue' || eventFields.length === 0) {
      continue
    }

    const values = splitAssCsvLine(eventMatch[2], eventFields.length)
    const getField = (name: string): string => values[eventFields.indexOf(name)]?.trim() ?? ''
    const style = getField('style')
    const effect = getField('effect')
    const rawText = getField('text')

    if (isDecorativeAssStyle(style) || isDecorativeAssStyle(effect)) continue
    if (hasAssDrawingOverride(rawText) || hasAssKaraokeOverride(rawText)) continue

    const text = cleanAssDialogueText(rawText)
    if (!text || isLikelyAssDrawingText(text)) continue

    const start = parseAssTimestamp(getField('start'))
    const end = parseAssTimestamp(getField('end'))
    if (start === null || end === null || end <= start) continue

    cues.push({ start, end, text })
  }

  const uniqueCues = cues.filter((cue, index) => {
    const cueKey = `${cue.start}:${cue.end}:${cue.text.toLocaleLowerCase()}`
    return (
      cues.findIndex(
        (candidate) =>
          `${candidate.start}:${candidate.end}:${candidate.text.toLocaleLowerCase()}` === cueKey
      ) === index
    )
  })

  return `WEBVTT\n\n${uniqueCues
    .map(
      (cue) =>
        `${formatVttTimestamp(cue.start)} --> ${formatVttTimestamp(cue.end)}\n${escapeVttText(
          cue.text
        )}`
    )
    .join('\n\n')}\n`
}

function readSubtitleContent(subtitlePath: string): SubtitleTrack['content'] {
  const extension = extname(subtitlePath).toLowerCase()
  const content = readFileSync(subtitlePath, 'utf8')

  if (extension === '.vtt') return normalizeSubtitleText(content)
  if (extension === '.ass' || extension === '.ssa') return normalizeSubtitleText(content)

  return convertSrtToVtt(content)
}

function getSidecarSubtitles(videoPath: string): SubtitleTrack[] {
  if (!videoPath || !existsSync(videoPath)) return []

  const videoDirectory = dirname(videoPath)
  const videoStem = parse(videoPath).name

  return readdirSync(videoDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const subtitlePath = join(videoDirectory, entry.name)
      const extension = extname(entry.name).toLowerCase()
      const subtitleStem = parse(entry.name).name

      return { entry, subtitlePath, extension, subtitleStem }
    })
    .filter(({ extension, subtitleStem }) => {
      if (!supportedSubtitleExtensions.has(extension)) return false

      return subtitleStem === videoStem || subtitleStem.startsWith(`${videoStem}.`)
    })
    .sort((first, second) =>
      basename(first.subtitlePath).localeCompare(basename(second.subtitlePath))
    )
    .map(({ subtitlePath, extension }) => ({
      id: subtitlePath,
      label: getSubtitleLabel(videoStem, subtitlePath),
      format: extension === '.vtt' ? 'vtt' : extension === '.srt' ? 'srt' : 'ass',
      content: readSubtitleContent(subtitlePath)
    }))
}

function getFfprobeCommand(): string {
  return process.env.NEXMP_FFPROBE_PATH || getFfprobeStaticPath() || 'ffprobe'
}

function getFfmpegCommand(): string {
  return process.env.NEXMP_FFMPEG_PATH || getFfmpegStaticPath() || 'ffmpeg'
}

async function listEmbeddedSubtitleStreams(videoPath: string): Promise<FfprobeSubtitleStream[]> {
  try {
    const { stdout } = await execFileAsync(
      getFfprobeCommand(),
      [
        '-v',
        'error',
        '-select_streams',
        's',
        '-show_entries',
        'stream=index,codec_name:stream_tags=language,title',
        '-of',
        'json',
        videoPath
      ],
      { maxBuffer: 1024 * 1024 }
    )
    const result = JSON.parse(stdout) as FfprobeSubtitleResult

    return result.streams ?? []
  } catch {
    return []
  }
}

function getEmbeddedSubtitleLabel(stream: FfprobeSubtitleStream, index: number): string {
  const title = stream.tags?.title?.trim()
  if (title) return `Embedded ${title}`

  const language = stream.tags?.language?.trim()
  if (language) {
    try {
      return `Embedded ${languageNames.of(language) ?? language.toUpperCase()}`
    } catch {
      return `Embedded ${language.toUpperCase()}`
    }
  }

  return `Embedded ${index + 1}`
}

async function extractEmbeddedSubtitle(
  videoPath: string,
  stream: FfprobeSubtitleStream,
  index: number,
  fontUrls: string[] = []
): Promise<SubtitleTrack | null> {
  if (typeof stream.index !== 'number') return null
  const codec = stream.codec_name?.toLowerCase() ?? ''
  if (!extractableEmbeddedSubtitleCodecs.has(codec)) return null

  try {
    const isAssSubtitle = codec === 'ass' || codec === 'ssa'
    const { stdout } = await execFileAsync(
      getFfmpegCommand(),
      [
        '-v',
        'error',
        '-i',
        videoPath,
        '-map',
        `0:${stream.index}`,
        '-f',
        isAssSubtitle ? 'ass' : 'webvtt',
        'pipe:1'
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    )

    if (!stdout.trim()) return null

    return {
      id: `${videoPath}#embedded-subtitle-${stream.index}`,
      label: getEmbeddedSubtitleLabel(stream, index),
      language: stream.tags?.language,
      format: isAssSubtitle ? 'ass' : 'vtt',
      content: normalizeSubtitleText(stdout),
      fontUrls: isAssSubtitle ? fontUrls : undefined
    }
  } catch {
    return null
  }
}

async function extractEmbeddedPlainSubtitle(
  videoPath: string,
  stream: FfprobeSubtitleStream,
  index: number
): Promise<SubtitleTrack | null> {
  if (typeof stream.index !== 'number') return null
  const codec = stream.codec_name?.toLowerCase() ?? ''
  if (codec !== 'ass' && codec !== 'ssa') return null

  try {
    const { stdout } = await execFileAsync(
      getFfmpegCommand(),
      ['-v', 'error', '-i', videoPath, '-map', `0:${stream.index}`, '-f', 'ass', 'pipe:1'],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    )

    if (!stdout.trim()) return null
    const content = convertAssToPlainVtt(stdout)
    if (!content.replace(/^WEBVTT\s*/i, '').trim()) return null

    return {
      id: `${videoPath}#embedded-subtitle-${stream.index}-plain`,
      label: `${getEmbeddedSubtitleLabel(stream, index)} (Plain fallback)`,
      language: stream.tags?.language,
      format: 'vtt',
      content
    }
  } catch {
    return null
  }
}

async function getEmbeddedSubtitles(videoPath: string): Promise<SubtitleTrack[]> {
  if (extname(videoPath).toLowerCase() !== '.mkv') return []

  const streams = await listEmbeddedSubtitleStreams(videoPath)
  const extractedTracks = await Promise.all(
    streams.map((stream, index) => {
      const codec = stream.codec_name?.toLowerCase() ?? ''

      if (codec === 'ass' || codec === 'ssa') {
        return extractEmbeddedPlainSubtitle(videoPath, stream, index)
      }

      return extractEmbeddedSubtitle(videoPath, stream, index)
    })
  )

  return extractedTracks.filter((track): track is SubtitleTrack => Boolean(track))
}

export async function listSubtitlesForVideo(
  videoPath: string,
  options: ListSubtitlesOptions = {}
): Promise<SubtitleTrack[]> {
  const sidecarSubtitles = getSidecarSubtitles(videoPath)
  const embeddedSubtitles = options.includeEmbedded ? await getEmbeddedSubtitles(videoPath) : []

  return [...sidecarSubtitles, ...embeddedSubtitles]
}
