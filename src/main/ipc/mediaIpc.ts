import { ipcMain } from 'electron'
import { OpenVideoResultSchema } from '../../shared/schemas/media'
import { openVideoDialog } from '../media/openVideoDialog'

const channels = {
  openVideo: 'media:open-video'
} as const

export function registerMediaIpc(): void {
  ipcMain.handle(channels.openVideo, async () => {
    const result = await openVideoDialog()

    return OpenVideoResultSchema.parse(result)
  })
}
