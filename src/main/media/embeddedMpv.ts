import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import net from 'node:net'
import { BrowserWindow, type WebContents } from 'electron'
import type {
  EmbeddedMpvPlaybackState,
  PlayerHostBounds,
  StartEmbeddedMpvInput
} from '../../shared/types/media'

type EmbeddedMpvSession = {
  owner: BrowserWindow
  host: BrowserWindow
  process: ChildProcess
  pipePath: string
  bounds: PlayerHostBounds
  cleanupOwnerListeners: () => void
}

const sessions = new Map<number, EmbeddedMpvSession>()
const startLocks = new Map<number, Promise<void>>()
const startGenerations = new Map<number, number>()

class EmbeddedMpvStartCanceledError extends Error {
  constructor() {
    super('MPV start was canceled.')
    this.name = 'EmbeddedMpvStartCanceledError'
  }
}

function getNextStartGeneration(webContentsId: number): number {
  const nextGeneration = (startGenerations.get(webContentsId) ?? 0) + 1
  startGenerations.set(webContentsId, nextGeneration)

  return nextGeneration
}

function assertStartIsCurrent(webContentsId: number, generation: number): void {
  if (startGenerations.get(webContentsId) !== generation) {
    throw new EmbeddedMpvStartCanceledError()
  }
}

function getSafeStartTime(startTimeSeconds: number | undefined): number {
  if (!Number.isFinite(startTimeSeconds) || startTimeSeconds === undefined) return 0

  return Math.max(startTimeSeconds, 0)
}

function getSafePlaybackRate(playbackRate: number | undefined): number {
  if (!Number.isFinite(playbackRate) || playbackRate === undefined) return 1

  return Math.min(Math.max(playbackRate, 0.25), 4)
}

function getMpvAspectOverride(aspectRatio: string | undefined): string {
  if (!aspectRatio || aspectRatio === 'original') return 'no'

  const [rawWidth, rawHeight] = aspectRatio.split(':')
  const width = Number(rawWidth)
  const height = Number(rawHeight)

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return 'no'
  }

  return String(width / height)
}

function getMpvExecutableCandidates(): string[] {
  return [
    process.env.NEXMP_MPV_PATH,
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'MPV Player', 'mpv.exe'),
    join(process.env.ProgramFiles ?? 'C:\\Program Files', 'mpv', 'mpv.exe'),
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'mpv', 'mpv.exe'),
    'mpv'
  ].filter((path): path is string => Boolean(path))
}

function getMpvExecutablePath(): string {
  const candidate = getMpvExecutableCandidates().find((executablePath) => {
    return executablePath === 'mpv' || existsSync(executablePath)
  })

  if (!candidate) {
    throw new Error('MPV was not found. Install mpv or set NEXMP_MPV_PATH.')
  }

  return candidate
}

function createPipePath(): string {
  if (process.platform === 'win32') {
    return `\\\\.\\pipe\\nexmp-mpv-${process.pid}-${randomUUID()}`
  }

  return join(tmpdir(), `nexmp-mpv-${process.pid}-${randomUUID()}.sock`)
}

function normalizeBounds(bounds: PlayerHostBounds): PlayerHostBounds {
  return {
    x: Math.max(Math.round(bounds.x), 0),
    y: Math.max(Math.round(bounds.y), 0),
    width: Math.max(Math.round(bounds.width), 1),
    height: Math.max(Math.round(bounds.height), 1)
  }
}

function toScreenBounds(owner: BrowserWindow, bounds: PlayerHostBounds): Electron.Rectangle {
  const contentBounds = owner.getContentBounds()
  const normalizedBounds = normalizeBounds(bounds)

  return {
    x: contentBounds.x + normalizedBounds.x,
    y: contentBounds.y + normalizedBounds.y,
    width: normalizedBounds.width,
    height: normalizedBounds.height
  }
}

function getWindowHandleId(window: BrowserWindow): string {
  const handle = window.getNativeWindowHandle()

  if (handle.length >= 8) {
    return handle.readBigUInt64LE(0).toString()
  }

  return handle.readUInt32LE(0).toString()
}

function applyHostBounds(session: EmbeddedMpvSession): void {
  if (session.owner.isDestroyed() || session.host.isDestroyed()) return

  session.host.setBounds(toScreenBounds(session.owner, session.bounds), false)
}

function destroySession(webContentsId: number): void {
  const session = sessions.get(webContentsId)
  if (!session) return

  sessions.delete(webContentsId)
  session.cleanupOwnerListeners()

  if (!session.process.killed) {
    session.process.kill()
  }

  if (!session.host.isDestroyed()) {
    session.host.destroy()
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

function sendMpvCommand<T = unknown>(pipePath: string, command: unknown[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(pipePath)
    const timeout = setTimeout(() => {
      socket.destroy()
      reject(new Error('MPV IPC timed out.'))
    }, 1200)
    let buffer = ''

    const cleanup = (): void => {
      clearTimeout(timeout)
      socket.removeAllListeners()
    }

    socket.on('connect', () => {
      socket.write(`${JSON.stringify({ command })}\n`)
    })

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8')
      const line = buffer.split('\n').find(Boolean)
      if (!line) return

      cleanup()
      socket.end()

      try {
        const payload = JSON.parse(line) as { data?: T; error?: string }
        if (payload.error && payload.error !== 'success') {
          reject(new Error(payload.error))
          return
        }

        resolve(payload.data as T)
      } catch (reason) {
        reject(reason)
      }
    })

    socket.on('error', (reason) => {
      cleanup()
      reject(reason)
    })
  })
}

async function waitForMpvIpc(pipePath: string, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await sendMpvCommand(pipePath, ['get_property', 'path'])
      return
    } catch (reason) {
      lastError = reason
      await delay(120)
    }
  }

  throw lastError instanceof Error ? lastError : new Error('MPV IPC was not ready.')
}

async function waitForMpvPlaybackReady(
  session: EmbeddedMpvSession,
  webContentsId: number,
  generation: number,
  timeoutMs = 10000
): Promise<void> {
  const startedAt = Date.now()
  let lastError: unknown = null

  while (Date.now() - startedAt < timeoutMs) {
    assertStartIsCurrent(webContentsId, generation)

    if (session.process.exitCode !== null || session.process.killed) {
      throw new Error('MPV exited before the video was ready.')
    }

    try {
      const [duration, voConfigured] = await Promise.all([
        sendMpvCommand<number | null>(session.pipePath, ['get_property', 'duration']),
        sendMpvCommand<boolean>(session.pipePath, ['get_property', 'vo-configured'])
      ])

      if ((typeof duration === 'number' && duration > 0) || voConfigured === true) {
        return
      }
    } catch (reason) {
      lastError = reason
    }

    await delay(120)
  }

  throw lastError instanceof Error ? lastError : new Error('MPV video output was not ready.')
}

async function getMpvProperty<T>(
  session: EmbeddedMpvSession,
  propertyName: string,
  fallbackValue: T
): Promise<T> {
  try {
    return await sendMpvCommand<T>(session.pipePath, ['get_property', propertyName])
  } catch {
    return fallbackValue
  }
}

function getSession(sender: WebContents): EmbeddedMpvSession | null {
  return sessions.get(sender.id) ?? null
}

async function startEmbeddedMpvNow(
  sender: WebContents,
  input: StartEmbeddedMpvInput,
  generation: number
): Promise<void> {
  const owner = BrowserWindow.fromWebContents(sender)
  if (!owner || owner.isDestroyed()) throw new Error('Player window was not found.')
  if (!input.videoPath || !existsSync(input.videoPath))
    throw new Error('Video file does not exist.')

  assertStartIsCurrent(sender.id, generation)
  destroySession(sender.id)

  const host = new BrowserWindow({
    parent: owner,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    focusable: false,
    hasShadow: false,
    backgroundColor: '#00000000',
    webPreferences: {
      sandbox: true
    }
  })

  host.setMenu(null)
  host.removeMenu()
  host.setBackgroundColor('#00000000')
  host.setIgnoreMouseEvents(true, { forward: true })
  const hostReady = host
    .loadURL(
      'data:text/html,<html><body style="margin:0;background:transparent;overflow:hidden"></body></html>'
    )
    .catch(() => {})

  const pipePath = createPipePath()
  const startTime = getSafeStartTime(input.startTimeSeconds)
  const executablePath = getMpvExecutablePath()
  const normalizedBounds = normalizeBounds(input.bounds)
  const updateBounds = (): void => {
    const session = sessions.get(sender.id)
    if (session) applyHostBounds(session)
  }
  const cleanupOwnerListeners = (): void => {
    owner.off('move', updateBounds)
    owner.off('resize', updateBounds)
    owner.off('closed', handleOwnerClosed)
  }
  const handleOwnerClosed = (): void => {
    destroySession(sender.id)
  }

  host.setBounds(toScreenBounds(owner, normalizedBounds), false)
  await hostReady
  assertStartIsCurrent(sender.id, generation)

  const args = [
    `--wid=${getWindowHandleId(host)}`,
    `--input-ipc-server=${pipePath}`,
    '--force-window=yes',
    '--osc=no',
    '--no-terminal',
    '--really-quiet',
    '--keep-open=no',
    '--keepaspect=yes',
    '--video-unscaled=no',
    '--panscan=0',
    '--embeddedfonts=yes',
    '--sub-ass=yes',
    '--sub-ass-override=no',
    '--sub-auto=fuzzy',
    '--audio-file-auto=fuzzy',
    `--speed=${getSafePlaybackRate(input.playbackRate)}`,
    `--video-aspect-override=${getMpvAspectOverride(input.aspectRatio)}`,
    ...(input.paused ? ['--pause'] : []),
    ...(typeof input.volume === 'number'
      ? [`--volume=${Math.round(Math.min(Math.max(input.volume, 0), 1) * 100)}`]
      : []),
    ...(startTime > 0 ? [`--start=${startTime}`] : []),
    input.videoPath
  ]

  const childProcess = spawn(executablePath, args, {
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'ignore']
  })

  owner.on('move', updateBounds)
  owner.on('resize', updateBounds)
  owner.on('closed', handleOwnerClosed)

  const session: EmbeddedMpvSession = {
    owner,
    host,
    process: childProcess,
    pipePath,
    bounds: normalizedBounds,
    cleanupOwnerListeners
  }

  sessions.set(sender.id, session)

  childProcess.once('exit', () => {
    destroySession(sender.id)
  })

  try {
    await waitForMpvIpc(pipePath)
    assertStartIsCurrent(sender.id, generation)
    await waitForMpvPlaybackReady(session, sender.id, generation)
    assertStartIsCurrent(sender.id, generation)
    host.showInactive()
  } catch (reason) {
    destroySession(sender.id)
    throw reason
  }
}

export async function startEmbeddedMpv(
  sender: WebContents,
  input: StartEmbeddedMpvInput
): Promise<void> {
  const generation = getNextStartGeneration(sender.id)
  const currentLock = startLocks.get(sender.id) ?? Promise.resolve()
  const nextLock = currentLock
    .catch(() => {})
    .then(() => {
      assertStartIsCurrent(sender.id, generation)
      return startEmbeddedMpvNow(sender, input, generation)
    })

  startLocks.set(sender.id, nextLock)

  try {
    await nextLock
  } finally {
    if (startLocks.get(sender.id) === nextLock) {
      startLocks.delete(sender.id)
    }
  }
}

export function updateEmbeddedMpvBounds(sender: WebContents, bounds: PlayerHostBounds): void {
  const session = getSession(sender)
  if (!session) return

  session.bounds = normalizeBounds(bounds)
  applyHostBounds(session)
}

export async function setEmbeddedMpvPaused(sender: WebContents, paused: boolean): Promise<void> {
  const session = getSession(sender)
  if (!session) return

  await sendMpvCommand(session.pipePath, ['set_property', 'pause', paused])
}

export async function seekEmbeddedMpv(sender: WebContents, seconds: number): Promise<void> {
  const session = getSession(sender)
  if (!session) return

  await sendMpvCommand(session.pipePath, [
    'seek',
    Math.max(Number.isFinite(seconds) ? seconds : 0, 0),
    'absolute',
    'exact'
  ])
}

export async function setEmbeddedMpvVolume(sender: WebContents, volume: number): Promise<void> {
  const session = getSession(sender)
  if (!session) return

  await sendMpvCommand(session.pipePath, [
    'set_property',
    'volume',
    Math.round(Math.min(Math.max(volume, 0), 1) * 100)
  ])
}

export async function setEmbeddedMpvPlaybackRate(
  sender: WebContents,
  playbackRate: number
): Promise<void> {
  const session = getSession(sender)
  if (!session) return

  await sendMpvCommand(session.pipePath, [
    'set_property',
    'speed',
    getSafePlaybackRate(playbackRate)
  ])
}

export async function setEmbeddedMpvAspectRatio(
  sender: WebContents,
  aspectRatio: string
): Promise<void> {
  const session = getSession(sender)
  if (!session) return

  await sendMpvCommand(session.pipePath, [
    'set_property',
    'video-aspect-override',
    getMpvAspectOverride(aspectRatio)
  ])
}

export async function setEmbeddedMpvSubtitlesVisible(
  sender: WebContents,
  isVisible: boolean
): Promise<void> {
  const session = getSession(sender)
  if (!session) return

  await sendMpvCommand(session.pipePath, ['set_property', 'sub-visibility', isVisible])
}

export async function getEmbeddedMpvState(sender: WebContents): Promise<EmbeddedMpvPlaybackState> {
  const session = getSession(sender)
  if (!session) {
    return {
      isRunning: false,
      paused: true,
      timePosition: 0,
      duration: 0,
      volume: 0
    }
  }

  const [paused, timePosition, duration, volume] = await Promise.all([
    getMpvProperty(session, 'pause', true),
    getMpvProperty(session, 'time-pos', 0),
    getMpvProperty(session, 'duration', 0),
    getMpvProperty(session, 'volume', 0)
  ])

  return {
    isRunning: true,
    paused: Boolean(paused),
    timePosition: typeof timePosition === 'number' ? timePosition : 0,
    duration: typeof duration === 'number' ? duration : 0,
    volume: typeof volume === 'number' ? volume / 100 : 0
  }
}

export function stopEmbeddedMpv(sender: WebContents): void {
  getNextStartGeneration(sender.id)
  destroySession(sender.id)
}

export function stopAllEmbeddedMpvSessions(): void {
  for (const webContentsId of sessions.keys()) {
    getNextStartGeneration(webContentsId)
    destroySession(webContentsId)
  }
}
