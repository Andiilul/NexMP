export type VideoFile = {
  name: string
  extension: string
  path: string
  url: string
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
}
