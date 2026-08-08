import type { CollectionApi } from './collection'
import type { ProfileApi } from './profile'

export type VideoFile = {
  mediaId?: string
  name: string
  extension: string
  path: string
  url: string
  sourceName?: string
  collectionName?: string
}

export type SubtitleTrack = {
  id: string
  label: string
  language?: string
  format: 'vtt' | 'srt' | 'ass'
  content: string
  fontUrls?: string[]
}

export type ListSubtitlesOptions = {
  includeEmbedded?: boolean
}

export type PlaybackProgressInput = {
  profileId: string
  mediaFileId: string
  positionSeconds: number
  durationSeconds?: number | null
  completed?: boolean
}

export type PlaybackSessionInput = {
  profileId: string
  playlist: VideoFile[]
  activeIndex: number
  collectionName?: string | null
  positionSeconds: number
  durationSeconds?: number | null
  completed?: boolean
}

export type PlayerEngine = 'html' | 'mpv'

export type PlayerHostBounds = {
  x: number
  y: number
  width: number
  height: number
}

export type StartEmbeddedMpvInput = {
  videoPath: string
  bounds: PlayerHostBounds
  startTimeSeconds?: number
  paused?: boolean
  volume?: number
  playbackRate?: number
  aspectRatio?: string
}

export type EmbeddedMpvPlaybackState = {
  isRunning: boolean
  paused: boolean
  timePosition: number
  duration: number
  volume: number
}

export type ContinueWatchingItem = {
  id: string
  mediaFileId: string
  positionSeconds: number
  durationSeconds: number | null
  completed: boolean
  lastPlayedAt: string | null
  collectionId: string
  collectionName: string
  sourceName: string
  filename: string
  filePath: string
  extension: string
  video: VideoFile
  playlist: VideoFile[]
  selectedIndex: number
}

export type OpenVideoResult =
  | {
      canceled: true
    }
  | {
      canceled: false
      video: VideoFile
      playlist: VideoFile[]
      selectedIndex: number
    }

export type MediaApi = {
  openVideo: () => Promise<OpenVideoResult>
  startEmbeddedMpv: (input: StartEmbeddedMpvInput) => Promise<void>
  updateEmbeddedMpvBounds: (bounds: PlayerHostBounds) => Promise<void>
  setEmbeddedMpvPaused: (paused: boolean) => Promise<void>
  seekEmbeddedMpv: (seconds: number) => Promise<void>
  setEmbeddedMpvVolume: (volume: number) => Promise<void>
  setEmbeddedMpvPlaybackRate: (playbackRate: number) => Promise<void>
  setEmbeddedMpvAspectRatio: (aspectRatio: string) => Promise<void>
  setEmbeddedMpvSubtitlesVisible: (isVisible: boolean) => Promise<void>
  getEmbeddedMpvState: () => Promise<EmbeddedMpvPlaybackState>
  stopEmbeddedMpv: () => Promise<void>
  listSubtitles: (videoPath: string, options?: ListSubtitlesOptions) => Promise<SubtitleTrack[]>
  savePlaybackProgress: (input: PlaybackProgressInput) => Promise<void>
  savePlaybackSession: (input: PlaybackSessionInput) => Promise<void>
  listContinueWatching: (profileId: string) => Promise<ContinueWatchingItem[]>
  clearContinueWatching: (profileId: string) => Promise<void>
}

export type NexmpApi = {
  media: MediaApi
  profiles: ProfileApi
  collections: CollectionApi
}
