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
    }

export type MediaApi = {
  openVideo: () => Promise<OpenVideoResult>
}

export type NexmpApi = {
  media: MediaApi
}
