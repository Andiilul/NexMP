import { contextBridge, ipcRenderer } from 'electron'
import type { NexmpApi } from '../shared/types/media'

const api: NexmpApi = {
  media: {
    openVideo: () => ipcRenderer.invoke('media:open-video')
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(window as Window & typeof globalThis & { api: NexmpApi }).api = api
}
