import { dialog } from 'electron'
import { extname, basename } from 'path'
import { createMediaProtocolUrl } from './mediaProtocol'
import type { OpenVideoResult } from '../../shared/types/media'

const videoExtensions = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']

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
  const extension = extname(filePath).replace('.', '').toLowerCase()

  return {
    canceled: false,
    video: {
      name: basename(filePath),
      extension,
      path: filePath,
      url: createMediaProtocolUrl(filePath)
    }
  }
}
