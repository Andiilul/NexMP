import type { MediaFile } from '../../../../shared/types/collection'
import type { VideoFile } from '../../../../shared/types/media'

export type PlayerRouteState = {
  playlist: VideoFile[]
  selectedIndex: number
  collectionName?: string
  returnTo?: string
  startTime?: number
}

export function createVideoFileFromMedia(media: MediaFile): VideoFile {
  return {
    mediaId: media.id,
    name: media.filename,
    extension: media.extension,
    path: media.filePath,
    url: media.url,
    sourceName: media.sourceName,
    collectionName: media.collectionName
  }
}

export function createPlayablePlaylist(mediaFiles: MediaFile[]): VideoFile[] {
  return mediaFiles
    .filter((media) => !media.isMissing && !media.isPending)
    .map(createVideoFileFromMedia)
}
