import type { CollectionApi } from './collection'
import type { ProfileApi } from './profile'

export type VideoFile = {
  name: string
  extension: string
  path: string
  url: string
  sourceName?: string
  collectionName?: string
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
}

export type NexmpApi = {
  media: MediaApi
  profiles: ProfileApi
  collections: CollectionApi
}
