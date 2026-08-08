import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FolderOpen, Loader2, LogOut, Play } from 'lucide-react'
import JASSUB from 'jassub'
import jassubModernWasmUrl from 'jassub/dist/wasm/jassub-worker-modern.wasm?url'
import jassubWasmUrl from 'jassub/dist/wasm/jassub-worker.wasm?url'
import jassubWorkerUrl from 'jassub/dist/worker/worker.js?worker&url'
import { useLocation, useNavigate } from 'react-router-dom'
import type { PlayerHostBounds, SubtitleTrack, VideoFile } from '../../../../shared/types/media'
import { useAppState } from '../../components/useAppState'
import type { PlayerRouteState } from '../collections/mediaPlayback'
import { HotkeysModal } from './HotkeysModal'
import { PlayerControls } from './PlayerControls'
import { PlaylistPanel } from './PlaylistPanel'
import { Toast, type ToastMessage } from './Toast'
import { createHtmlVideoPlaybackEngine } from './playbackEngine'
import { formatTime } from './time'
import logoIconMonochrome from '../../../../../public/logos/logo-icon-monochrome.png'

const defaultSkipSeconds = 5
const shiftedSkipSeconds = 10
const controlledSkipSeconds = 30
const alternateSkipSeconds = 60
const idleTimeMs = 3000
const toastVisibleMs = 1200
const progressSaveIntervalMs = 5000
const mpvOverlayHeaderReservePx = 88
const mpvOverlayControlsReservePx = 132
const volumeStep = 0.05
const speedStep = 0.25
const minPlaybackRate = 0.25
const maxPlaybackRate = 4
const showControllerPreviewWithoutVideo = import.meta.env.DEV
const previewVideoFile: VideoFile = {
  name: 'Controller preview',
  extension: 'mp4',
  path: 'Preview mode - open a video to test playback',
  url: ''
}
const mediaErrorMessages: Record<number, string> = {
  1: 'Video loading was aborted.',
  2: 'Network error while loading the video.',
  3: 'Video decode failed. The container opened, but the codec may be unsupported.',
  4: 'Unsupported video source or unreadable file.'
}

const videoRatios = ['original', '16:9', '4:3', '16:10', '1:1', '2.21:1', '2.35:1', '5:4'] as const
type VideoRatio = (typeof videoRatios)[number]
type Size = {
  width: number
  height: number
}

function getNextRatio(currentRatio: VideoRatio): VideoRatio {
  const currentIndex = videoRatios.indexOf(currentRatio)
  return videoRatios[(currentIndex + 1) % videoRatios.length]
}

function getRatioValue(ratio: VideoRatio, naturalSize: Size | null): number {
  switch (ratio) {
    case '16:9':
      return 16 / 9
    case '4:3':
      return 4 / 3
    case '16:10':
      return 16 / 10
    case '1:1':
      return 1
    case '2.21:1':
      return 2.21
    case '2.35:1':
      return 2.35
    case '5:4':
      return 5 / 4
    default:
      if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
        return naturalSize.width / naturalSize.height
      }

      return 16 / 9
  }
}

function getContainSize(containerSize: Size, ratio: number): Size {
  if (containerSize.width <= 0 || containerSize.height <= 0) {
    return { width: 0, height: 0 }
  }

  const containerRatio = containerSize.width / containerSize.height

  if (containerRatio > ratio) {
    return {
      width: containerSize.height * ratio,
      height: containerSize.height
    }
  }

  return {
    width: containerSize.width,
    height: containerSize.width / ratio
  }
}

function formatSkipAmount(seconds: number): string {
  if (seconds === 60) return '1 Minute'

  return `${seconds} Sec`
}

function getKeyboardSkipSeconds(event: KeyboardEvent): number {
  if (event.altKey) return alternateSkipSeconds
  if (event.ctrlKey) return controlledSkipSeconds
  if (event.shiftKey) return shiftedSkipSeconds

  return defaultSkipSeconds
}

function openBrowserVideoFile(): Promise<VideoFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')

    input.type = 'file'
    input.accept = 'video/*,.mp4,.mkv,.webm,.mov,.avi,.m4v'
    input.onchange = () => {
      const file = input.files?.[0]

      if (!file) {
        resolve(null)
        return
      }

      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

      resolve({
        name: file.name,
        extension,
        path: file.name,
        url: URL.createObjectURL(file)
      })
    }

    input.click()
  })
}

function getSubtitlePreferenceScore(track: SubtitleTrack): number {
  const label = track.label.toLowerCase()
  let score = 0

  if (/\bplain fallback\b/.test(label)) score += 80
  if (/\b(full|dialogue|dialog|main|default)\b/.test(label)) score += 40
  if (/\b(signs?|songs?|karaoke|lyrics?|op|ed|opening|ending|ncop|nced)\b/.test(label)) {
    score -= 30
  }
  if (track.format === 'ass') score += 5

  return score
}

function getPreferredSubtitleTrack(tracks: SubtitleTrack[]): SubtitleTrack | null {
  return (
    tracks
      .map((track, index) => ({ track, index, score: getSubtitlePreferenceScore(track) }))
      .sort((first, second) => second.score - first.score || first.index - second.index)[0]
      ?.track ?? null
  )
}

type TextSubtitleCue = {
  start: number
  end: number
  text: string
}

function parseVttTimestamp(value: string): number | null {
  const match = value.trim().match(/^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})/)
  if (!match) return null

  const hours = Number(match[1] ?? 0)
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = Number(match[4])

  return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
}

function decodeSubtitleEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function cleanSubtitleText(value: string): string {
  return decodeSubtitleEntities(
    value
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  )
}

function isLikelyAssDrawingText(value: string): boolean {
  const normalizedValue = value.replace(/\s+/g, ' ').trim().toLowerCase()
  if (!normalizedValue) return false

  const tokens = normalizedValue.split(' ')
  const numericTokens = tokens.filter((token) => /^-?\d+(?:\.\d+)?$/.test(token)).length
  const drawingCommandTokens = tokens.filter((token) => /^(m|n|l|b|s|p|c)$/.test(token)).length
  const wordTokens = tokens.filter((token) => /[a-z]/.test(token) && !/^(m|n|l|b|s|p|c)$/.test(token))
    .length

  return (
    tokens.length >= 8 &&
    numericTokens >= 6 &&
    drawingCommandTokens > 0 &&
    wordTokens === 0 &&
    numericTokens / tokens.length > 0.55
  )
}

function normalizeVisibleSubtitleText(value: string): string {
  return value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()
}

function parseTextSubtitleCues(content: string): TextSubtitleCue[] {
  const blocks = content
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)

  return blocks
    .map((block) => {
      const lines = block
        .split('\n')
        .map((line) => line.trimEnd())
        .filter(Boolean)

      if (lines.length === 0) return null
      if (/^(WEBVTT|NOTE|STYLE|REGION)(\s|$)/i.test(lines[0] ?? '')) return null

      const timingIndex = lines.findIndex((line) => line.includes('-->'))
      if (timingIndex === -1) return null

      const [rawStart, rawEnd] = (lines[timingIndex] ?? '').split(/\s+-->\s+/)
      const start = parseVttTimestamp(rawStart ?? '')
      const end = parseVttTimestamp((rawEnd ?? '').split(/\s+/)[0] ?? '')
      if (start === null || end === null || end <= start) return null

      const text = cleanSubtitleText(lines.slice(timingIndex + 1).join('\n'))
      if (!text) return null
      if (isLikelyAssDrawingText(text)) return null

      return { start, end, text }
    })
    .filter((cue): cue is TextSubtitleCue => Boolean(cue))
}

function getUniqueVisibleSubtitleTexts(cues: TextSubtitleCue[], currentTime: number): string[] {
  const seenTexts = new Set<string>()
  const visibleTexts: string[] = []

  cues.forEach((cue) => {
    if (currentTime < cue.start || currentTime > cue.end) return

    const normalizedText = normalizeVisibleSubtitleText(cue.text)
    if (!normalizedText || seenTexts.has(normalizedText)) return

    seenTexts.add(normalizedText)
    visibleTexts.push(cue.text)
  })

  return visibleTexts
}

function getElementHostBounds(element: HTMLElement | null, reserveBottom = 0): PlayerHostBounds {
  const rect = element?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0, width: 1, height: 1 }

  return {
    x: rect.left,
    y: rect.top,
    width: Math.max(rect.width, 1),
    height: Math.max(rect.height - reserveBottom, 1)
  }
}

function getMpvHostBounds(element: HTMLElement | null, reserveOverlay: boolean): PlayerHostBounds {
  const bounds = getElementHostBounds(element)
  if (!reserveOverlay) return bounds

  const topReserve = Math.min(mpvOverlayHeaderReservePx, Math.floor(bounds.height * 0.22))
  const bottomReserve = Math.min(mpvOverlayControlsReservePx, Math.floor(bounds.height * 0.32))

  return {
    x: bounds.x,
    y: bounds.y + topReserve,
    width: bounds.width,
    height: Math.max(bounds.height - topReserve - bottomReserve, 1)
  }
}

export function PlayerPage(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const { appState } = useAppState()
  const initialRouteState = location.state as PlayerRouteState | null
  const initialPlaylist = initialRouteState?.playlist ?? []
  const initialSelectedIndex =
    initialPlaylist.length > 0
      ? Math.min(initialRouteState?.selectedIndex ?? 0, initialPlaylist.length - 1)
      : null
  const initialCollectionName =
    initialRouteState?.collectionName ?? initialPlaylist[0]?.collectionName ?? null
  const returnTo = initialRouteState?.returnTo ?? null
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const playerStageRef = useRef<HTMLDivElement | null>(null)
  const videoFrameRef = useRef<HTMLDivElement | null>(null)
  const subtitleLayerRef = useRef<HTMLDivElement | null>(null)
  const controlsTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const cursorIdleTimerRef = useRef<number | null>(null)
  const lastProgressSaveAtRef = useRef(0)
  const pendingStartTimeRef = useRef(initialRouteState?.startTime ?? 0)
  const controlsPinnedRef = useRef(false)
  const suppressNextPauseRevealRef = useRef(false)
  const shouldAutoplayRef = useRef(initialPlaylist.length > 0)
  const isMpvRunningRef = useRef(false)
  const playbackRateRef = useRef(1)
  const aspectRatioRef = useRef<VideoRatio>('original')
  const [videoFile, setVideoFile] = useState<VideoFile | null>(
    initialSelectedIndex === null ? null : (initialPlaylist[initialSelectedIndex] ?? null)
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMpvLoading, setIsMpvLoading] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [isCursorIdle, setIsCursorIdle] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [showHotkeys, setShowHotkeys] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(initialPlaylist.length > 1)
  const [playlist, setPlaylist] = useState<VideoFile[]>(initialPlaylist)
  const [activePlaylistIndex, setActivePlaylistIndex] = useState<number | null>(
    initialSelectedIndex
  )
  const [collectionName, setCollectionName] = useState<string | null>(initialCollectionName)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [aspectRatio, setAspectRatio] = useState<VideoRatio>('original')
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true)
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([])
  const [subtitleUrls, setSubtitleUrls] = useState<Record<string, string>>({})
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(null)
  const [hasTriedEmbeddedSubtitles, setHasTriedEmbeddedSubtitles] = useState(false)
  const [isLoadingEmbeddedSubtitles, setIsLoadingEmbeddedSubtitles] = useState(false)
  const [playerStageSize, setPlayerStageSize] = useState<Size>({ width: 0, height: 0 })
  const [naturalVideoSize, setNaturalVideoSize] = useState<Size | null>(null)
  const shouldUseMpvEngine = appState.playerEngine === 'mpv' && Boolean(videoFile?.path)
  const activeSubtitleTrack = useMemo(
    () => subtitleTracks.find((track) => track.id === activeSubtitleId) ?? null,
    [activeSubtitleId, subtitleTracks]
  )
  const textSubtitleTracks = useMemo(
    () => subtitleTracks.filter((track) => track.format !== 'ass'),
    [subtitleTracks]
  )
  const activeTextSubtitleCues = useMemo(
    () =>
      activeSubtitleTrack && activeSubtitleTrack.format !== 'ass'
        ? parseTextSubtitleCues(activeSubtitleTrack.content)
        : [],
    [activeSubtitleTrack]
  )
  const visibleSubtitleTexts = useMemo(() => {
    if (shouldUseMpvEngine || !subtitlesEnabled || activeTextSubtitleCues.length === 0) return []

    return getUniqueVisibleSubtitleTexts(activeTextSubtitleCues, currentTime)
  }, [activeTextSubtitleCues, currentTime, shouldUseMpvEngine, subtitlesEnabled])

  const getEngine = useCallback(() => {
    if (!videoRef.current) return null

    return createHtmlVideoPlaybackEngine(videoRef.current)
  }, [])

  const hideControlsLater = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current)
    }
    if (cursorIdleTimerRef.current) {
      window.clearTimeout(cursorIdleTimerRef.current)
    }

    controlsTimerRef.current = window.setTimeout(() => {
      if (!controlsPinnedRef.current) {
        setShowControls(false)
      }
    }, idleTimeMs)
    cursorIdleTimerRef.current = window.setTimeout(() => {
      setIsCursorIdle(true)
    }, idleTimeMs)
  }, [])

  const revealControls = useCallback(() => {
    setIsCursorIdle(false)
    setShowControls(true)
    hideControlsLater()
  }, [hideControlsLater])

  useEffect(() => {
    const playerStage = playerStageRef.current
    if (!playerStage) return

    const updatePlayerStageSize = (): void => {
      setPlayerStageSize({
        width: playerStage.clientWidth,
        height: playerStage.clientHeight
      })
    }

    updatePlayerStageSize()

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        updatePlayerStageSize()
        return
      }

      setPlayerStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      })
    })

    observer.observe(playerStage)

    return () => {
      observer.disconnect()
    }
  }, [])

  const playCurrentVideo = useCallback(async () => {
    if (shouldUseMpvEngine) {
      await window.api?.media.setEmbeddedMpvPaused(false)
      setIsPlaying(true)
      hideControlsLater()
      return
    }

    const engine = getEngine()
    if (!engine || !videoFile) return

    setError(null)

    try {
      await engine.play()
    } catch {
      setError('This video could not be played. Try an MP4 H.264/AAC file first.')
      revealControls()
    }
  }, [getEngine, hideControlsLater, revealControls, shouldUseMpvEngine, videoFile])

  const activateVideo = useCallback(
    (nextVideo: VideoFile, nextIndex: number, autoplay: boolean, startTime = 0) => {
      shouldAutoplayRef.current = autoplay
      pendingStartTimeRef.current = startTime
      lastProgressSaveAtRef.current = 0
      setVideoFile(nextVideo)
      setActivePlaylistIndex(nextIndex)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
      setIsMpvLoading(false)
      setError(null)
      setNaturalVideoSize(null)
      setSubtitleTracks([])
      setActiveSubtitleId(null)
      setHasTriedEmbeddedSubtitles(false)
      setIsLoadingEmbeddedSubtitles(false)
    },
    []
  )

  const saveCurrentPlaybackProgress = useCallback(
    (positionSeconds: number, durationSeconds: number, completed = false): void => {
      const profileId = sessionStorage.getItem('nexmp.active-profile-id')
      if (!profileId || !videoFile?.mediaId || !window.api?.media) return
      if (!Number.isFinite(positionSeconds) || positionSeconds < 0) return

      void window.api.media.savePlaybackProgress({
        profileId,
        mediaFileId: videoFile.mediaId,
        positionSeconds,
        durationSeconds:
          Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
        completed
      })
    },
    [videoFile]
  )

  const saveCurrentPlaybackSession = useCallback(
    (positionSeconds: number, durationSeconds: number, completed = false): void => {
      const profileId = sessionStorage.getItem('nexmp.active-profile-id')
      if (!profileId || playlist.length === 0 || !window.api?.media) return

      const selectedIndex =
        activePlaylistIndex === null
          ? 0
          : Math.min(Math.max(activePlaylistIndex, 0), playlist.length - 1)

      void window.api.media.savePlaybackSession({
        profileId,
        playlist,
        activeIndex: selectedIndex,
        collectionName,
        positionSeconds,
        durationSeconds:
          Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : null,
        completed
      })
    },
    [activePlaylistIndex, collectionName, playlist]
  )

  const openVideo = useCallback(async () => {
    setError(null)

    try {
      const result = window.api
        ? await window.api.media.openVideo()
        : await openBrowserVideoFile().then((video) =>
            video
              ? { canceled: false as const, video, playlist: [video], selectedIndex: 0 }
              : { canceled: true as const }
          )

      if (result.canceled || !result.video) return

      const nextPlaylist = result.playlist.length > 0 ? result.playlist : [result.video]
      const nextSelectedIndex = Math.min(result.selectedIndex, nextPlaylist.length - 1)

      setPlaylist(nextPlaylist)
      setCollectionName(null)
      activateVideo(nextPlaylist[nextSelectedIndex] ?? result.video, nextSelectedIndex, true)
      setAspectRatio('original')
      setShowPlaylist(nextPlaylist.length > 1)
      revealControls()
    } catch {
      setError('Could not open the selected video.')
      revealControls()
    }
  }, [activateVideo, revealControls])

  const exitPlayer = useCallback(() => {
    const video = videoRef.current
    if (videoFile) {
      const positionSeconds = shouldUseMpvEngine ? currentTime : (video?.currentTime ?? currentTime)
      const durationSeconds = shouldUseMpvEngine ? duration : (video?.duration ?? duration)

      saveCurrentPlaybackProgress(positionSeconds, durationSeconds, false)
      saveCurrentPlaybackSession(positionSeconds, durationSeconds, false)
    }
    void window.api?.media.stopEmbeddedMpv()
    navigate(returnTo && returnTo !== '/player' ? returnTo : '/home')
  }, [
    currentTime,
    duration,
    navigate,
    returnTo,
    saveCurrentPlaybackProgress,
    saveCurrentPlaybackSession,
    shouldUseMpvEngine,
    videoFile
  ])

  useEffect(() => {
    if (shouldUseMpvEngine) return

    const engine = getEngine()
    if (!engine || !videoFile) return

    engine.load(videoFile.url)

    return () => {
      engine.destroy()
    }
  }, [getEngine, shouldUseMpvEngine, videoFile])

  const updateMpvHostBounds = useCallback((): void => {
    if (!shouldUseMpvEngine || !isMpvRunningRef.current) return

    void window.api?.media.updateEmbeddedMpvBounds(
      getMpvHostBounds(videoFrameRef.current, showControls)
    )
  }, [shouldUseMpvEngine, showControls])

  useEffect(() => {
    if (!shouldUseMpvEngine || !videoFile?.path || !window.api?.media) {
      void window.api?.media.stopEmbeddedMpv()
      isMpvRunningRef.current = false
      setIsMpvLoading(false)
      return
    }

    let isCanceled = false
    const startMpv = async (): Promise<void> => {
      try {
        setError(null)
        setIsMpvLoading(true)
        const shouldPause = !shouldAutoplayRef.current

        await window.api?.media.startEmbeddedMpv({
          videoPath: videoFile.path,
          bounds: getMpvHostBounds(videoFrameRef.current, true),
          startTimeSeconds: pendingStartTimeRef.current,
          paused: shouldPause,
          volume,
          playbackRate: playbackRateRef.current,
          aspectRatio: aspectRatioRef.current
        })

        if (isCanceled) return

        isMpvRunningRef.current = true
        setIsMpvLoading(false)
        shouldAutoplayRef.current = false
        pendingStartTimeRef.current = 0
        if (!subtitlesEnabled) {
          await window.api?.media.setEmbeddedMpvSubtitlesVisible(false)
        }
        setIsPlaying(!shouldPause)
        if (!shouldPause) {
          hideControlsLater()
        }
      } catch (reason) {
        if (!isCanceled) {
          isMpvRunningRef.current = false
          setIsMpvLoading(false)
          setError(reason instanceof Error ? reason.message : 'MPV engine could not start.')
          revealControls()
        }
      }
    }

    void startMpv()

    return () => {
      isCanceled = true
      isMpvRunningRef.current = false
      setIsMpvLoading(false)
      void window.api?.media.stopEmbeddedMpv()
    }
  }, [hideControlsLater, revealControls, shouldUseMpvEngine, videoFile?.path])

  useEffect(() => {
    updateMpvHostBounds()
  }, [playerStageSize, showControls, showPlaylist, updateMpvHostBounds])

  useEffect(() => {
    if (!shouldUseMpvEngine || !window.api?.media) return

    let isCanceled = false
    const pollState = async (): Promise<void> => {
      try {
        const state = await window.api?.media.getEmbeddedMpvState()
        if (isCanceled) return
        if (!state?.isRunning) {
          if (isMpvRunningRef.current) {
            isMpvRunningRef.current = false
            setIsMpvLoading(false)
            setIsPlaying(false)
            setError('MPV engine stopped before the video was ready.')
            revealControls()
          }
          return
        }

        setCurrentTime(state.timePosition)
        setDuration(state.duration)
        setIsPlaying(!state.paused)
        if (state.duration > 0 || state.timePosition > 0) {
          setIsMpvLoading(false)
        }

        const now = Date.now()
        if (now - lastProgressSaveAtRef.current >= progressSaveIntervalMs) {
          lastProgressSaveAtRef.current = now
          saveCurrentPlaybackProgress(state.timePosition, state.duration, false)
        }
      } catch {
        // MPV may still be creating its IPC pipe. The next poll can recover.
      }
    }

    void pollState()
    const interval = window.setInterval(() => {
      void pollState()
    }, 500)

    return () => {
      isCanceled = true
      window.clearInterval(interval)
    }
  }, [revealControls, saveCurrentPlaybackProgress, shouldUseMpvEngine])

  useEffect(() => {
    let isCanceled = false
    const objectUrls: string[] = []

    setSubtitleTracks([])
    setSubtitleUrls({})
    setActiveSubtitleId(null)
    setHasTriedEmbeddedSubtitles(false)
    setIsLoadingEmbeddedSubtitles(false)

    if (shouldUseMpvEngine) return

    const loadSubtitles = async (): Promise<void> => {
      if (!videoFile?.path || !window.api?.media) return
      const shouldLoadEmbeddedSubtitles = videoFile.extension.toLowerCase() === 'mkv'

      try {
        setHasTriedEmbeddedSubtitles(shouldLoadEmbeddedSubtitles)
        setIsLoadingEmbeddedSubtitles(shouldLoadEmbeddedSubtitles)
        const tracks = await window.api.media.listSubtitles(videoFile.path, {
          includeEmbedded: shouldLoadEmbeddedSubtitles
        })
        if (isCanceled) return

        const nextSubtitleUrls = tracks.reduce<Record<string, string>>((urls, track) => {
          if (track.format === 'ass') return urls

          const objectUrl = URL.createObjectURL(
            new Blob([track.content], { type: 'text/vtt;charset=utf-8' })
          )
          objectUrls.push(objectUrl)

          return { ...urls, [track.id]: objectUrl }
        }, {})

        setSubtitleTracks(tracks)
        setSubtitleUrls(nextSubtitleUrls)
        setActiveSubtitleId(getPreferredSubtitleTrack(tracks)?.id ?? null)
      } catch (reason) {
        if (!isCanceled) {
          setSubtitleTracks([])
          setSubtitleUrls({})
          setActiveSubtitleId(null)
          setError(reason instanceof Error ? reason.message : 'Subtitles could not be loaded.')
          revealControls()
        }
      } finally {
        if (!isCanceled) {
          setIsLoadingEmbeddedSubtitles(false)
        }
      }
    }

    void loadSubtitles()

    return () => {
      isCanceled = true
      for (const objectUrl of objectUrls) {
        URL.revokeObjectURL(objectUrl)
      }
    }
  }, [shouldUseMpvEngine, videoFile])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    Array.from(video.textTracks).forEach((track) => {
      track.mode = 'disabled'
    })
  }, [activeSubtitleId, subtitlesEnabled, textSubtitleTracks, videoFile])

  useEffect(() => {
    const video = videoRef.current
    const subtitleLayer = subtitleLayerRef.current
    if (
      shouldUseMpvEngine ||
      !video ||
      !subtitleLayer ||
      !subtitlesEnabled ||
      activeSubtitleTrack?.format !== 'ass'
    ) {
      return
    }

    let isCanceled = false
    let renderer: JASSUB | null = null
    const canvas = document.createElement('canvas')
    canvas.className = 'JASSUB'
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    canvas.style.backgroundColor = 'transparent'
    canvas.style.zIndex = '5'
    subtitleLayer.appendChild(canvas)

    try {
      renderer = new JASSUB({
        video,
        canvas,
        subContent: activeSubtitleTrack.content,
        fonts: activeSubtitleTrack.fontUrls ?? [],
        queryFonts: false,
        workerUrl: jassubWorkerUrl,
        wasmUrl: jassubWasmUrl,
        modernWasmUrl: jassubModernWasmUrl
      })
    } catch (reason) {
      canvas.remove()
      setError(reason instanceof Error ? reason.message : 'Styled ASS subtitles could not load.')
      revealControls()
      return
    }

    renderer.ready.catch((reason: unknown) => {
      if (isCanceled) return

      setError(reason instanceof Error ? reason.message : 'Styled ASS subtitles could not load.')
      revealControls()
    })

    return () => {
      isCanceled = true
      void renderer?.destroy()
      if (canvas.isConnected) {
        canvas.remove()
      }
    }
  }, [activeSubtitleTrack, revealControls, shouldUseMpvEngine, subtitlesEnabled, videoFile])

  useEffect(() => {
    getEngine()?.setVolume(volume)
  }, [getEngine, volume])

  useEffect(() => {
    playbackRateRef.current = playbackRate

    if (shouldUseMpvEngine) {
      void window.api?.media.setEmbeddedMpvPlaybackRate(playbackRate)
      return
    }

    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate, shouldUseMpvEngine])

  useEffect(() => {
    aspectRatioRef.current = aspectRatio

    if (!shouldUseMpvEngine) return

    void window.api?.media.setEmbeddedMpvAspectRatio(aspectRatio)
  }, [aspectRatio, shouldUseMpvEngine])

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current)
      }
      if (cursorIdleTimerRef.current) {
        window.clearTimeout(cursorIdleTimerRef.current)
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (videoFile) {
      hideControlsLater()
    }
  }, [hideControlsLater, videoFile])

  const togglePlay = useCallback(
    async (revealController = true) => {
      if (shouldUseMpvEngine) {
        const nextIsPlaying = !isPlaying
        await window.api?.media.setEmbeddedMpvPaused(!nextIsPlaying)
        setIsPlaying(nextIsPlaying)

        if (nextIsPlaying) {
          hideControlsLater()
        } else if (revealController) {
          revealControls()
        }
        return
      }

      const video = videoRef.current
      const engine = getEngine()
      if (!video || !engine || !videoFile) return

      setError(null)

      try {
        if (video.paused) {
          await engine.play()
          hideControlsLater()
        } else {
          suppressNextPauseRevealRef.current = !revealController
          engine.pause()
          if (revealController) {
            revealControls()
          }
        }
      } catch {
        setError('This video could not be played. Try an MP4 H.264/AAC file first.')
        revealControls()
      }
    },
    [getEngine, hideControlsLater, isPlaying, revealControls, shouldUseMpvEngine, videoFile]
  )

  const showToast = useCallback((message: ToastMessage) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setToast(message)

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, toastVisibleMs)
  }, [])

  const showSkipToast = useCallback(
    (seconds: number, targetTime: number) => {
      const direction = seconds >= 0 ? 'Forward' : 'Backward'

      showToast({
        title: `Skip ${formatSkipAmount(Math.abs(seconds))} ${direction}`,
        description: `${formatTime(targetTime)} / ${formatTime(duration)}`
      })
    },
    [duration, showToast]
  )

  const seekTo = useCallback(
    (seconds: number, revealController = true) => {
      if (shouldUseMpvEngine) {
        const safeTime = Math.min(Math.max(seconds, 0), duration || Number.MAX_SAFE_INTEGER)
        setCurrentTime(safeTime)
        void window.api?.media.seekEmbeddedMpv(safeTime)
        if (revealController) {
          revealControls()
        }
        return
      }

      const engine = getEngine()
      if (!engine || !videoFile) return

      engine.seek(seconds)
      setCurrentTime(seconds)
      if (revealController) {
        revealControls()
      }
    },
    [duration, getEngine, revealControls, shouldUseMpvEngine, videoFile]
  )

  const skipBy = useCallback(
    (seconds: number, revealController = true) => {
      const safeTargetTime = Math.min(Math.max(currentTime + seconds, 0), duration || 0)

      seekTo(safeTargetTime, revealController)
      showSkipToast(seconds, safeTargetTime)
    },
    [currentTime, duration, seekTo, showSkipToast]
  )

  const playPlaylistItem = useCallback(
    (nextIndex: number, autoplay = true, revealController = true) => {
      const nextVideo = playlist[nextIndex]
      if (!nextVideo) return

      activateVideo(nextVideo, nextIndex, autoplay)
      if (revealController) {
        revealControls()
      }
    },
    [activateVideo, playlist, revealControls]
  )

  const playNextPlaylistItem = useCallback(
    (revealController = true) => {
      if (activePlaylistIndex === null) return

      const nextIndex = activePlaylistIndex + 1
      if (nextIndex >= playlist.length) {
        setIsPlaying(false)
        if (revealController) {
          revealControls()
        }
        showToast({ title: 'End of Playlist' })
        return
      }

      playPlaylistItem(nextIndex, true, revealController)
      showToast({
        title: 'Next Video',
        description: playlist[nextIndex]?.name
      })
    },
    [activePlaylistIndex, playPlaylistItem, playlist, revealControls, showToast]
  )

  const playPreviousPlaylistItem = useCallback(
    (revealController = true) => {
      if (activePlaylistIndex === null) return

      const previousIndex = activePlaylistIndex - 1
      if (previousIndex < 0) {
        showToast({ title: 'Start of Playlist' })
        if (revealController) {
          revealControls()
        }
        return
      }

      playPlaylistItem(previousIndex, true, revealController)
      showToast({
        title: 'Previous Video',
        description: playlist[previousIndex]?.name
      })
    },
    [activePlaylistIndex, playPlaylistItem, playlist, revealControls, showToast]
  )

  const reorderPlaylist = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
      if (fromIndex >= playlist.length || toIndex >= playlist.length) return

      const reorderedPlaylist = [...playlist]
      const [movedVideo] = reorderedPlaylist.splice(fromIndex, 1)

      if (!movedVideo) return

      reorderedPlaylist.splice(toIndex, 0, movedVideo)
      setPlaylist(reorderedPlaylist)

      if (videoFile) {
        const nextActiveIndex = reorderedPlaylist.findIndex(
          (video) => video.path === videoFile.path
        )
        setActivePlaylistIndex(nextActiveIndex >= 0 ? nextActiveIndex : null)
      }
    },
    [playlist, videoFile]
  )

  const removePlaylistItem = useCallback(
    (index: number) => {
      const removedVideo = playlist[index]
      if (!removedVideo) return

      const nextPlaylist = playlist.filter((_, itemIndex) => itemIndex !== index)
      setPlaylist(nextPlaylist)

      if (videoFile?.path === removedVideo.path) {
        const replacementIndex = Math.min(index, nextPlaylist.length - 1)
        const replacementVideo = nextPlaylist[replacementIndex]

        if (replacementVideo) {
          activateVideo(replacementVideo, replacementIndex, true)
        } else {
          getEngine()?.destroy()
          setVideoFile(null)
          setActivePlaylistIndex(null)
          setCurrentTime(0)
          setDuration(0)
          setIsPlaying(false)
          setIsCursorIdle(false)
          setShowControls(true)
          setError(null)
          setNaturalVideoSize(null)
        }
      } else if (videoFile) {
        const nextActiveIndex = nextPlaylist.findIndex((item) => item.path === videoFile.path)
        setActivePlaylistIndex(nextActiveIndex >= 0 ? nextActiveIndex : null)
      }

      showToast({ title: 'Removed from Playlist', description: removedVideo.name })
      revealControls()
    },
    [activateVideo, getEngine, playlist, revealControls, showToast, videoFile]
  )

  const changeVolume = useCallback(
    (nextVolume: number, revealController = true) => {
      const safeVolume = Math.min(Math.max(nextVolume, 0), 1)

      setVolume(safeVolume)
      setIsMuted(safeVolume === 0)
      if (videoRef.current) {
        videoRef.current.muted = safeVolume === 0
      }
      if (shouldUseMpvEngine) {
        void window.api?.media.setEmbeddedMpvVolume(safeVolume)
      } else {
        getEngine()?.setVolume(safeVolume)
      }
      if (revealController) {
        revealControls()
      }
    },
    [getEngine, revealControls, shouldUseMpvEngine]
  )

  const changeVolumeBy = useCallback(
    (delta: number, revealController = true) => {
      const nextVolume = Math.min(Math.max(volume + delta, 0), 1)

      changeVolume(nextVolume, revealController)
      showToast({
        title: delta > 0 ? 'Volume Up' : 'Volume Down',
        description: `${Math.round(nextVolume * 100)}%`
      })
    },
    [changeVolume, showToast, volume]
  )

  const toggleMute = useCallback(
    (revealController = true) => {
      if (shouldUseMpvEngine) {
        const nextMuted = !isMuted
        setIsMuted(nextMuted)
        void window.api?.media.setEmbeddedMpvVolume(nextMuted ? 0 : volume)
        showToast({ title: nextMuted ? 'Mute' : 'Unmute' })
        if (revealController) {
          revealControls()
        }
        return
      }

      const video = videoRef.current
      if (!video) return

      const nextMuted = !video.muted
      video.muted = nextMuted
      setIsMuted(nextMuted)
      showToast({ title: nextMuted ? 'Mute' : 'Unmute' })
      if (revealController) {
        revealControls()
      }
    },
    [isMuted, revealControls, shouldUseMpvEngine, showToast, volume]
  )

  const toggleFullscreen = useCallback(
    async (revealController = true) => {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        showToast({ title: 'Exit Fullscreen' })
        if (revealController) {
          revealControls()
        }
        return
      }

      await shellRef.current?.requestFullscreen()
      showToast({ title: 'Enter Fullscreen' })
      if (revealController) {
        revealControls()
      }
    },
    [revealControls, showToast]
  )

  const stopVideo = useCallback(
    (revealController = true) => {
      void window.api?.media.stopEmbeddedMpv()
      isMpvRunningRef.current = false
      getEngine()?.destroy()
      setVideoFile(null)
      setCollectionName(null)
      setActivePlaylistIndex(null)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
      setIsCursorIdle(false)
      setShowControls(true)
      setError(null)
      setNaturalVideoSize(null)
      showToast({ title: 'Stop' })
      if (revealController) {
        revealControls()
      }
    },
    [getEngine, revealControls, showToast]
  )

  const changePlaybackRateBy = useCallback(
    (delta: number, revealController = true) => {
      const nextRate = Math.min(Math.max(playbackRate + delta, minPlaybackRate), maxPlaybackRate)
      const safeRate = Number(nextRate.toFixed(2))

      setPlaybackRate(safeRate)
      if (shouldUseMpvEngine) {
        void window.api?.media.setEmbeddedMpvPlaybackRate(safeRate)
      }
      showToast({
        title: delta > 0 ? 'Speed Up' : 'Speed Down',
        description: `${safeRate.toFixed(2)}x`
      })
      if (revealController) {
        revealControls()
      }
    },
    [playbackRate, revealControls, shouldUseMpvEngine, showToast]
  )

  const resetPlaybackRate = useCallback(
    (revealController = true) => {
      setPlaybackRate(1)
      if (shouldUseMpvEngine) {
        void window.api?.media.setEmbeddedMpvPlaybackRate(1)
      }
      showToast({ title: 'Speed Reset', description: '1.00x' })
      if (revealController) {
        revealControls()
      }
    },
    [revealControls, shouldUseMpvEngine, showToast]
  )

  const cycleAspectRatio = useCallback(
    (revealController = true) => {
      const nextRatio = getNextRatio(aspectRatio)

      setAspectRatio(nextRatio)
      if (shouldUseMpvEngine) {
        void window.api?.media.setEmbeddedMpvAspectRatio(nextRatio)
      }
      showToast({ title: 'Aspect Ratio', description: nextRatio })
      if (revealController) {
        revealControls()
      }
    },
    [aspectRatio, revealControls, shouldUseMpvEngine, showToast]
  )

  const toggleSubtitles = useCallback(
    async (revealController = true) => {
      const video = videoRef.current

      if (shouldUseMpvEngine) {
        const nextEnabled = !subtitlesEnabled
        setSubtitlesEnabled(nextEnabled)
        await window.api?.media.setEmbeddedMpvSubtitlesVisible(nextEnabled)
        showToast({ title: nextEnabled ? 'Subtitles On' : 'Subtitles Off' })
        if (revealController) {
          revealControls()
        }
        return
      }

      if (subtitleTracks.length === 0) {
        const isMkv = videoFile?.extension.toLowerCase() === 'mkv'

        if (
          isMkv &&
          videoFile?.path &&
          window.api?.media &&
          !hasTriedEmbeddedSubtitles &&
          !isLoadingEmbeddedSubtitles
        ) {
          setHasTriedEmbeddedSubtitles(true)
          setIsLoadingEmbeddedSubtitles(true)
          showToast({
            title: 'Checking Embedded Subtitles',
            description: 'Trying FFmpeg/FFprobe now...'
          })

          try {
            const tracks = await window.api.media.listSubtitles(videoFile.path, {
              includeEmbedded: true
            })
            const nextSubtitleUrls = tracks.reduce<Record<string, string>>((urls, track) => {
              if (track.format === 'ass') return urls

              const objectUrl = URL.createObjectURL(
                new Blob([track.content], { type: 'text/vtt;charset=utf-8' })
              )

              return { ...urls, [track.id]: objectUrl }
            }, {})

            if (tracks.length > 0) {
              setSubtitleTracks(tracks)
              setSubtitleUrls((currentUrls) => {
                Object.values(currentUrls).forEach((objectUrl) => URL.revokeObjectURL(objectUrl))

                return nextSubtitleUrls
              })
              setActiveSubtitleId(getPreferredSubtitleTrack(tracks)?.id ?? null)
              setSubtitlesEnabled(true)
              showToast({
                title: 'Subtitles On',
                description: `${tracks.length} embedded track${tracks.length === 1 ? '' : 's'} found.`
              })
              if (revealController) {
                revealControls()
              }
              return
            }

            Object.values(nextSubtitleUrls).forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
          } finally {
            setIsLoadingEmbeddedSubtitles(false)
          }
        }

        showToast({
          title: isMkv ? 'No Embedded Subtitles Loaded' : 'No Sidecar Subtitles',
          description: isMkv
            ? 'Embedded MKV subtitles could not be loaded. This quick fix supports text-based subtitle streams only.'
            : 'Put a .srt or .vtt file next to this video with the same name.'
        })
        if (revealController) {
          revealControls()
        }
        return
      }

      if (!subtitlesEnabled) {
        const preferredTrack = getPreferredSubtitleTrack(subtitleTracks)

        setActiveSubtitleId((currentTrackId) => currentTrackId ?? preferredTrack?.id ?? null)
        setSubtitlesEnabled(true)
        showToast({
          title: 'Subtitles On',
          description: activeSubtitleTrack?.label ?? preferredTrack?.label
        })
        if (revealController) {
          revealControls()
        }
        return
      }

      const activeTrackIndex = subtitleTracks.findIndex((track) => track.id === activeSubtitleId)
      if (subtitleTracks.length > 1 && activeTrackIndex < subtitleTracks.length - 1) {
        const nextTrack = subtitleTracks[activeTrackIndex + 1] ?? subtitleTracks[0]

        setActiveSubtitleId(nextTrack?.id ?? null)
        setSubtitlesEnabled(Boolean(nextTrack))
        showToast({
          title: 'Subtitle Track',
          description: nextTrack?.label
        })
        if (revealController) {
          revealControls()
        }
        return
      }

      if (video) {
        Array.from(video.textTracks).forEach((track) => {
          track.mode = 'disabled'
        })
      }

      setSubtitlesEnabled(false)
      showToast({ title: 'Subtitles Off' })
      if (revealController) {
        revealControls()
      }
    },
    [
      activeSubtitleId,
      hasTriedEmbeddedSubtitles,
      isLoadingEmbeddedSubtitles,
      revealControls,
      showToast,
      activeSubtitleTrack,
      subtitleTracks,
      subtitleTracks.length,
      shouldUseMpvEngine,
      subtitlesEnabled,
      videoFile
    ]
  )

  const switchAudioTrack = useCallback(
    (revealController = true) => {
      showToast({ title: 'Audio Track', description: 'Not available yet' })
      if (revealController) {
        revealControls()
      }
    },
    [revealControls, showToast]
  )

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return

      if (showHotkeys) {
        if (event.code === 'Escape') {
          event.preventDefault()
          setShowHotkeys(false)
          showToast({ title: 'Close Hotkeys' })
        }
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        showToast({ title: isPlaying ? 'Pause' : 'Play' })
        void togglePlay(false)
      }

      if (event.code === 'KeyG') {
        event.preventDefault()
        setShowHotkeys(true)
        showToast({ title: 'Open Hotkeys' })
      }

      if (event.code === 'KeyL') {
        event.preventDefault()
        setShowPlaylist((isVisible) => !isVisible)
        showToast({ title: showPlaylist ? 'Close Playlist' : 'Open Playlist' })
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        skipBy(-getKeyboardSkipSeconds(event), false)
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault()
        skipBy(getKeyboardSkipSeconds(event), false)
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault()
        changeVolumeBy(volumeStep, false)
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault()
        changeVolumeBy(-volumeStep, false)
      }

      if (event.code === 'KeyM') {
        event.preventDefault()
        toggleMute(false)
      }

      if (event.code === 'KeyF') {
        event.preventDefault()
        void toggleFullscreen(false)
      }

      if (event.code === 'Escape') {
        event.preventDefault()
        if (document.fullscreenElement) {
          void document.exitFullscreen()
          showToast({ title: 'Exit Fullscreen' })
        } else {
          showToast({ title: 'Hide Overlay' })
        }
        setShowControls(false)
      }

      if (event.code === 'KeyS' && event.ctrlKey) {
        event.preventDefault()
        stopVideo(false)
      }

      if (event.code === 'KeyN') {
        event.preventDefault()
        playNextPlaylistItem(false)
      }

      if (event.code === 'KeyP') {
        event.preventDefault()
        playPreviousPlaylistItem(false)
      }

      if (event.code === 'BracketLeft') {
        event.preventDefault()
        changePlaybackRateBy(-speedStep, false)
      }

      if (event.code === 'BracketRight') {
        event.preventDefault()
        changePlaybackRateBy(speedStep, false)
      }

      if (event.code === 'Backslash') {
        event.preventDefault()
        resetPlaybackRate(false)
      }

      if (event.code === 'KeyA') {
        event.preventDefault()
        cycleAspectRatio(false)
      }

      if (event.code === 'KeyH') {
        event.preventDefault()
        void toggleSubtitles(false)
      }

      if (event.code === 'KeyB') {
        event.preventDefault()
        switchAudioTrack(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    changePlaybackRateBy,
    changeVolumeBy,
    cycleAspectRatio,
    playNextPlaylistItem,
    playPreviousPlaylistItem,
    resetPlaybackRate,
    showHotkeys,
    showPlaylist,
    showToast,
    isPlaying,
    skipBy,
    stopVideo,
    switchAudioTrack,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    toggleSubtitles
  ])

  const displayedVideoFile =
    videoFile ?? (showControllerPreviewWithoutVideo ? previewVideoFile : null)
  const displayedCurrentTime = videoFile ? currentTime : 0
  const displayedDuration = videoFile ? duration : 0
  const displayedIsPlaying = videoFile ? isPlaying : false
  const isPreviewingControls = showControllerPreviewWithoutVideo && !videoFile
  const isOverlayVisible = isPreviewingControls || showControls
  const controlsClassName = isOverlayVisible
    ? 'pointer-events-auto absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] opacity-0 transition-opacity duration-150'
  const mpvHeaderClassName = isOverlayVisible
    ? 'pointer-events-auto absolute inset-x-0 top-0 z-30 opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-x-0 top-0 z-30 opacity-0 transition-opacity duration-150'
  const mpvControlsClassName = isOverlayVisible
    ? 'pointer-events-auto absolute inset-x-0 bottom-0 z-30 opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-x-0 bottom-0 z-30 opacity-0 transition-opacity duration-150'
  const mpvTopGradientClassName = isOverlayVisible
    ? 'pointer-events-none absolute inset-x-0 top-0 z-20 h-40 bg-gradient-to-b from-black/70 to-transparent opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-x-0 top-0 z-20 h-40 bg-gradient-to-b from-black/70 to-transparent opacity-0 transition-opacity duration-150'
  const mpvBottomGradientClassName = isOverlayVisible
    ? 'pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[230px] bg-gradient-to-t from-black/85 to-transparent opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[230px] bg-gradient-to-t from-black/85 to-transparent opacity-0 transition-opacity duration-150'
  const subtitleOverlayClassName =
    'pointer-events-none absolute inset-x-[8%] bottom-[8%] z-[15] flex flex-col items-center gap-1 text-center'
  const activeVideoRatio = getRatioValue(aspectRatio, naturalVideoSize)
  const containedVideoSize = getContainSize(playerStageSize, activeVideoRatio)
  const videoFrameStyle =
    !shouldUseMpvEngine && containedVideoSize.width > 0 && containedVideoSize.height > 0
      ? { width: `${containedVideoSize.width}px`, height: `${containedVideoSize.height}px` }
      : undefined
  const videoFrameClassName = shouldUseMpvEngine
    ? 'absolute inset-0 z-0 grid min-h-0 min-w-0 place-items-center overflow-hidden bg-[#050608]'
    : 'relative grid min-h-0 min-w-0 place-items-center overflow-hidden bg-[#050608] transition-[width,height] duration-300 ease-out'
  const videoClassName = 'block h-full w-full bg-[#050608] object-fill'
  const playerStageClassName = shouldUseMpvEngine
    ? 'relative h-full min-h-0 min-w-0 overflow-hidden bg-[#08090b] transition-[width] duration-300 ease-out'
    : 'relative grid h-full min-h-0 min-w-0 place-items-center overflow-hidden bg-[#08090b] transition-[width] duration-300 ease-out'
  const shellClassName = showPlaylist
    ? 'grid h-[calc(100vh-36px)] grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.08] bg-[#050608] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-[grid-template-columns] duration-300 ease-out'
    : 'grid h-[calc(100vh-36px)] grid-cols-[0px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.08] bg-[#050608] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-[grid-template-columns] duration-300 ease-out'
  const playerShellClassName = `${shellClassName} ${isCursorIdle && videoFile ? 'cursor-none' : ''}`
  const playerHeader = displayedVideoFile ? (
    <header className="z-10 flex items-center justify-between gap-4 px-[22px] py-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-[#e9edf9]">
          <img className="h-[26px] w-[26px] object-contain" src={logoIconMonochrome} alt="" />
        </span>
        <div>
          <h1 className="max-w-[62vw] truncate text-lg leading-[22px] font-bold text-[#f3f5fb]">
            {collectionName ?? 'NexMP'}
          </h1>
          <p className="max-w-[62vw] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[18px] text-[#ebeef8]/70">
            {displayedVideoFile.name}
          </p>
        </div>
      </div>

      <button
        className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md bg-[#e9edf9] px-3.5 font-bold text-[#111319]"
        type="button"
        onClick={exitPlayer}
      >
        <LogOut size={18} />
        Exit
      </button>
    </header>
  ) : null
  const playerControls = displayedVideoFile ? (
    <PlayerControls
      videoFile={displayedVideoFile}
      isPlaying={displayedIsPlaying}
      isMuted={isMuted}
      currentTime={displayedCurrentTime}
      duration={displayedDuration}
      volume={volume}
      aspectRatioLabel={aspectRatio}
      subtitlesEnabled={subtitlesEnabled}
      subtitleTrackCount={shouldUseMpvEngine ? 1 : subtitleTracks.length}
      activeSubtitleLabel={
        shouldUseMpvEngine ? 'MPV embedded subtitles' : activeSubtitleTrack?.label
      }
      canPlayPrevious={activePlaylistIndex !== null && activePlaylistIndex > 0}
      canPlayNext={activePlaylistIndex !== null && activePlaylistIndex < playlist.length - 1}
      onChangeVolume={changeVolume}
      onControlsEnter={() => {
        controlsPinnedRef.current = true
        setShowControls(true)
      }}
      onControlsLeave={() => {
        controlsPinnedRef.current = false
        hideControlsLater()
      }}
      onSeek={seekTo}
      onCycleAspectRatio={cycleAspectRatio}
      onToggleSubtitles={() => void toggleSubtitles()}
      onPlayPrevious={playPreviousPlaylistItem}
      onPlayNext={playNextPlaylistItem}
      onOpenHotkeys={() => {
        setShowHotkeys(true)
        revealControls()
      }}
      onTogglePlaylist={() => {
        setShowPlaylist((isVisible) => !isVisible)
        revealControls()
      }}
      onToggleFullscreen={() => void toggleFullscreen()}
      onToggleMute={toggleMute}
      onTogglePlay={() => void togglePlay()}
    />
  ) : null

  return (
    <main className="min-h-screen bg-[#101114] p-[18px]">
      <section
        className={playerShellClassName}
        ref={shellRef}
        onMouseMove={videoFile ? revealControls : undefined}
      >
        <div className="min-w-0 overflow-hidden">
          <PlaylistPanel
            isVisible={showPlaylist}
            playlist={playlist}
            activeIndex={activePlaylistIndex}
            collectionName={collectionName}
            onPlay={playPlaylistItem}
            onRemove={removePlaylistItem}
            onReorder={reorderPlaylist}
          />
        </div>
        <div ref={playerStageRef} className={playerStageClassName}>
          {!displayedVideoFile && (
            <button
              className="absolute z-10 inline-flex items-center gap-3 rounded-lg border border-white/12 bg-[#1c1f26]/90 px-[18px] py-3.5 font-bold text-[#f3f5fb]"
              type="button"
              onClick={openVideo}
            >
              <FolderOpen size={32} />
              <span>Open a video file</span>
            </button>
          )}

          {shouldUseMpvEngine && displayedVideoFile && (
            <>
              <Toast message={toast} />
              <div className={mpvTopGradientClassName} />
              <div className={mpvBottomGradientClassName} />
              <div className={mpvHeaderClassName}>{playerHeader}</div>
            </>
          )}

          <div ref={videoFrameRef} className={videoFrameClassName} style={videoFrameStyle}>
            <video
              ref={videoRef}
              autoPlay
              className={`${videoClassName} ${shouldUseMpvEngine ? 'opacity-0' : ''}`}
              preload="metadata"
              onCanPlay={() => {
                if (!shouldAutoplayRef.current) return

                shouldAutoplayRef.current = false
                void playCurrentVideo()
              }}
              onClick={() => void togglePlay()}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget

                setDuration(video.duration)
                if (
                  pendingStartTimeRef.current > 0 &&
                  Number.isFinite(video.duration) &&
                  video.duration > 0
                ) {
                  video.currentTime = Math.min(
                    pendingStartTimeRef.current,
                    Math.max(video.duration - 1, 0)
                  )
                  setCurrentTime(video.currentTime)
                  pendingStartTimeRef.current = 0
                }
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  setNaturalVideoSize({
                    width: video.videoWidth,
                    height: video.videoHeight
                  })
                }
              }}
              onTimeUpdate={(event) => {
                const video = event.currentTarget
                setCurrentTime(video.currentTime)

                const now = Date.now()
                if (now - lastProgressSaveAtRef.current < progressSaveIntervalMs) return
                lastProgressSaveAtRef.current = now
                saveCurrentPlaybackProgress(video.currentTime, video.duration, false)
              }}
              onEnded={(event) => {
                const video = event.currentTarget
                saveCurrentPlaybackProgress(
                  video.duration || video.currentTime,
                  video.duration,
                  true
                )
                playNextPlaylistItem()
              }}
              onPlay={() => {
                setIsPlaying(true)
                hideControlsLater()
              }}
              onPause={() => {
                const video = videoRef.current
                if (video) {
                  saveCurrentPlaybackProgress(video.currentTime, video.duration, false)
                }
                setIsPlaying(false)
                if (suppressNextPauseRevealRef.current) {
                  suppressNextPauseRevealRef.current = false
                  return
                }
                revealControls()
              }}
              onVolumeChange={(event) => {
                setIsMuted(event.currentTarget.muted)
                setVolume(event.currentTarget.volume)
              }}
              onError={(event) => {
                const errorCode = event.currentTarget.error?.code
                setError(
                  errorCode
                    ? mediaErrorMessages[errorCode]
                    : 'Unsupported video format or unreadable file.'
                )
                revealControls()
              }}
            >
              {textSubtitleTracks.map((track) => {
                const subtitleUrl = subtitleUrls[track.id]
                if (!subtitleUrl) return null

                return (
                  <track
                    key={track.id}
                    src={subtitleUrl}
                    kind="subtitles"
                    label={track.label}
                    srcLang={track.language ?? 'und'}
                    default={false}
                    onLoad={() => {
                      const video = videoRef.current
                      if (!video) return

                      Array.from(video.textTracks).forEach((textTrack) => {
                        textTrack.mode = 'disabled'
                      })
                    }}
                  />
                )
              })}
            </video>
            <div
              ref={subtitleLayerRef}
              className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
            />
            {shouldUseMpvEngine && (isMpvLoading || error) && (
              <div className="pointer-events-auto absolute inset-0 z-30 grid place-items-center bg-[#050608]">
                <div className="flex max-w-[min(440px,calc(100%-48px))] flex-col items-center gap-3 rounded-xl border border-white/10 bg-[#111318]/92 px-5 py-4 text-center shadow-[0_18px_60px_rgba(0,0,0,0.45)]">
                  {isMpvLoading && !error ? (
                    <>
                      <Loader2 className="animate-spin text-[#00ff99]" size={30} />
                      <div>
                        <p className="font-bold text-[#f3f5fb]">Preparing MPV engine…</p>
                        <p className="mt-1 text-sm text-[#c9ced8]/70">
                          Waiting until the video output is ready.
                        </p>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-bold text-[#ffb8ae]">MPV engine could not play this.</p>
                      <p className="text-sm text-[#ffb8ae]/80">{error}</p>
                    </>
                  )}
                </div>
              </div>
            )}
            {visibleSubtitleTexts.length > 0 && (
              <div className={subtitleOverlayClassName}>
                {visibleSubtitleTexts.map((text, cueIndex) => (
                  <p
                    key={`${cueIndex}-${text}`}
                    className="max-w-full whitespace-pre-line bg-transparent px-1 text-[clamp(20px,2.7vw,42px)] leading-[1.16] font-semibold tracking-[0.01em] text-white [background:none] [box-shadow:none] [text-shadow:0_2px_3px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.95),0_0_5px_rgba(0,0,0,0.85)]"
                  >
                    {text}
                  </p>
                ))}
              </div>
            )}
          </div>

          {shouldUseMpvEngine && displayedVideoFile && (
            <div className={mpvControlsClassName}>{playerControls}</div>
          )}

          {!shouldUseMpvEngine && displayedVideoFile && (
            <>
              <Toast message={toast} />
              <div className={controlsClassName}>
                <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[230px] bg-gradient-to-t from-black/85 to-transparent" />

                <header className="z-10 flex items-center justify-between gap-4 px-[22px] py-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-[#e9edf9]">
                      <img
                        className="h-[26px] w-[26px] object-contain"
                        src={logoIconMonochrome}
                        alt=""
                      />
                    </span>
                    <div>
                      <h1 className="max-w-[62vw] truncate text-lg leading-[22px] font-bold text-[#f3f5fb]">
                        {collectionName ?? 'NexMP'}
                      </h1>
                      <p className="max-w-[62vw] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[18px] text-[#ebeef8]/70">
                        {displayedVideoFile.name}
                      </p>
                    </div>
                  </div>

                  <button
                    className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md bg-[#e9edf9] px-3.5 font-bold text-[#111319]"
                    type="button"
                    onClick={exitPlayer}
                  >
                    <LogOut size={18} />
                    Exit
                  </button>
                </header>

                {!displayedIsPlaying && (
                  <button
                    className="z-10 grid h-[74px] w-[74px] place-items-center self-center justify-self-center rounded-full bg-[#e9edf9]/90 text-[#111319] shadow-[0_14px_40px_rgba(0,0,0,0.34)]"
                    type="button"
                    onClick={() => void togglePlay()}
                    aria-label="Play"
                  >
                    <Play size={34} fill="currentColor" />
                  </button>
                )}

                {error && (
                  <div className="z-10 flex self-stretch justify-end px-[22px] pb-3">
                    <div className="rounded-md border border-[#ff6f60]/25 bg-[#3e1c1f]/90 px-3 py-2.5 text-[13px] text-[#ffb8ae]">
                      {error}
                    </div>
                  </div>
                )}

                <PlayerControls
                  videoFile={displayedVideoFile}
                  isPlaying={displayedIsPlaying}
                  isMuted={isMuted}
                  currentTime={displayedCurrentTime}
                  duration={displayedDuration}
                  volume={volume}
                  aspectRatioLabel={aspectRatio}
                  subtitlesEnabled={subtitlesEnabled}
                  subtitleTrackCount={shouldUseMpvEngine ? 1 : subtitleTracks.length}
                  activeSubtitleLabel={
                    shouldUseMpvEngine ? 'MPV embedded subtitles' : activeSubtitleTrack?.label
                  }
                  canPlayPrevious={activePlaylistIndex !== null && activePlaylistIndex > 0}
                  canPlayNext={
                    activePlaylistIndex !== null && activePlaylistIndex < playlist.length - 1
                  }
                  onChangeVolume={changeVolume}
                  onControlsEnter={() => {
                    controlsPinnedRef.current = true
                    setShowControls(true)
                  }}
                  onControlsLeave={() => {
                    controlsPinnedRef.current = false
                    hideControlsLater()
                  }}
                  onSeek={seekTo}
                  onCycleAspectRatio={cycleAspectRatio}
                  onToggleSubtitles={() => void toggleSubtitles()}
                  onPlayPrevious={playPreviousPlaylistItem}
                  onPlayNext={playNextPlaylistItem}
                  onOpenHotkeys={() => {
                    setShowHotkeys(true)
                    revealControls()
                  }}
                  onTogglePlaylist={() => {
                    setShowPlaylist((isVisible) => !isVisible)
                    revealControls()
                  }}
                  onToggleFullscreen={() => void toggleFullscreen()}
                  onToggleMute={toggleMute}
                  onTogglePlay={() => void togglePlay()}
                />
              </div>
            </>
          )}
          {showHotkeys && <HotkeysModal onClose={() => setShowHotkeys(false)} />}
        </div>
      </section>
    </main>
  )
}
