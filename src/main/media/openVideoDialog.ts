import { dialog } from 'electron'
import { readdir } from 'fs/promises'
import { extname, basename, dirname, join } from 'path'
import { createMediaProtocolUrl } from './mediaProtocol'
import type { OpenVideoResult, VideoFile } from '../../shared/types/media'

const videoExtensions = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']
const videoExtensionSet = new Set(videoExtensions)
const naturalNameSorter = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
})

function createVideoFile(filePath: string): VideoFile {
  const extension = extname(filePath).replace('.', '').toLowerCase()

  return {
    name: basename(filePath),
    extension,
    path: filePath,
    url: createMediaProtocolUrl(filePath)
  }
}

async function createFolderPlaylist(selectedFilePath: string): Promise<VideoFile[]> {
  const folderPath = dirname(selectedFilePath)
  const entries = await readdir(folderPath, { withFileTypes: true })

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(folderPath, entry.name))
    .filter((filePath) => videoExtensionSet.has(extname(filePath).replace('.', '').toLowerCase()))
    .sort((firstPath, secondPath) =>
      naturalNameSorter.compare(basename(firstPath), basename(secondPath))
    )
    .map(createVideoFile)
}

export async function openVideoDialog(): Promise<OpenVideoResult> {
  const result = await dialog.showOpenDialog({
    title: 'Open video',
    properties: ['openFile'],
    filters: [
      {
        name: 'Video files',
        extensions: videoExtensions
      },
      {
        name: 'All files',
        extensions: ['*']
      }
    ]
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true }
  }

  const filePath = result.filePaths[0]
  const selectedVideo = createVideoFile(filePath)
  let playlist = [selectedVideo]

  try {
    playlist = await createFolderPlaylist(filePath)
  } catch {
    playlist = [selectedVideo]
  }

  const selectedIndex = Math.max(
    playlist.findIndex((video) => video.path === filePath),
    0
  )

  return {
    canceled: false,
    video: playlist[selectedIndex] ?? selectedVideo,
    playlist,
    selectedIndex
  }
}
