import { ipcMain } from 'electron'
import { OpenVideoResultSchema } from '../../shared/schemas/media'
import type {
  ListSubtitlesOptions,
  PlayerHostBounds,
  PlaybackProgressInput,
  PlaybackSessionInput,
  StartEmbeddedMpvInput
} from '../../shared/types/media'
import { listSubtitlesForVideo } from '../media/subtitles'
import { openVideoDialog } from '../media/openVideoDialog'
import {
  getEmbeddedMpvState,
  seekEmbeddedMpv,
  setEmbeddedMpvAspectRatio,
  setEmbeddedMpvPaused,
  setEmbeddedMpvPlaybackRate,
  setEmbeddedMpvSubtitlesVisible,
  setEmbeddedMpvVolume,
  startEmbeddedMpv,
  stopEmbeddedMpv,
  updateEmbeddedMpvBounds
} from '../media/embeddedMpv'
import {
  clearContinueWatching,
  listContinueWatching,
  savePlaybackProgress,
  savePlaybackSession
} from '../services/playbackProgressService'

const channels = {
  openVideo: 'media:open-video',
  startEmbeddedMpv: 'media:mpv-start',
  updateEmbeddedMpvBounds: 'media:mpv-update-bounds',
  setEmbeddedMpvPaused: 'media:mpv-set-paused',
  seekEmbeddedMpv: 'media:mpv-seek',
  setEmbeddedMpvVolume: 'media:mpv-set-volume',
  setEmbeddedMpvPlaybackRate: 'media:mpv-set-playback-rate',
  setEmbeddedMpvAspectRatio: 'media:mpv-set-aspect-ratio',
  setEmbeddedMpvSubtitlesVisible: 'media:mpv-set-subtitles-visible',
  getEmbeddedMpvState: 'media:mpv-get-state',
  stopEmbeddedMpv: 'media:mpv-stop',
  listSubtitles: 'media:list-subtitles',
  savePlaybackProgress: 'media:save-playback-progress',
  savePlaybackSession: 'media:save-playback-session',
  listContinueWatching: 'media:list-continue-watching',
  clearContinueWatching: 'media:clear-continue-watching'
} as const

export function registerMediaIpc(): void {
  ipcMain.handle(channels.openVideo, async (event) => {
    const result = await openVideoDialog(event.sender)

    return OpenVideoResultSchema.parse(result)
  })
  ipcMain.handle(channels.startEmbeddedMpv, (event, input: StartEmbeddedMpvInput) =>
    startEmbeddedMpv(event.sender, input)
  )
  ipcMain.handle(channels.updateEmbeddedMpvBounds, (event, bounds: PlayerHostBounds) =>
    updateEmbeddedMpvBounds(event.sender, bounds)
  )
  ipcMain.handle(channels.setEmbeddedMpvPaused, (event, paused: boolean) =>
    setEmbeddedMpvPaused(event.sender, paused)
  )
  ipcMain.handle(channels.seekEmbeddedMpv, (event, seconds: number) =>
    seekEmbeddedMpv(event.sender, seconds)
  )
  ipcMain.handle(channels.setEmbeddedMpvVolume, (event, volume: number) =>
    setEmbeddedMpvVolume(event.sender, volume)
  )
  ipcMain.handle(channels.setEmbeddedMpvPlaybackRate, (event, playbackRate: number) =>
    setEmbeddedMpvPlaybackRate(event.sender, playbackRate)
  )
  ipcMain.handle(channels.setEmbeddedMpvAspectRatio, (event, aspectRatio: string) =>
    setEmbeddedMpvAspectRatio(event.sender, aspectRatio)
  )
  ipcMain.handle(channels.setEmbeddedMpvSubtitlesVisible, (event, isVisible: boolean) =>
    setEmbeddedMpvSubtitlesVisible(event.sender, isVisible)
  )
  ipcMain.handle(channels.getEmbeddedMpvState, (event) => getEmbeddedMpvState(event.sender))
  ipcMain.handle(channels.stopEmbeddedMpv, (event) => stopEmbeddedMpv(event.sender))
  ipcMain.handle(
    channels.listSubtitles,
    (_event, videoPath: string, options?: ListSubtitlesOptions) =>
      listSubtitlesForVideo(videoPath, options)
  )
  ipcMain.handle(channels.savePlaybackProgress, (_event, input: PlaybackProgressInput) => {
    savePlaybackProgress(input)
  })
  ipcMain.handle(channels.savePlaybackSession, (_event, input: PlaybackSessionInput) => {
    savePlaybackSession(input)
  })
  ipcMain.handle(channels.listContinueWatching, (_event, profileId: string) =>
    listContinueWatching(profileId)
  )
  ipcMain.handle(channels.clearContinueWatching, (_event, profileId: string) =>
    clearContinueWatching(profileId)
  )
}
