import { contextBridge, ipcRenderer } from 'electron'
import type { NexmpApi } from '../shared/types/media'

const api: NexmpApi = {
  media: {
    openVideo: () => ipcRenderer.invoke('media:open-video')
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    create: (input) => ipcRenderer.invoke('profiles:create', input)
  },
  collections: {
    list: (profileId) => ipcRenderer.invoke('collections:list', profileId),
    create: (input) => ipcRenderer.invoke('collections:create', input),
    update: (input) => ipcRenderer.invoke('collections:update', input),
    delete: (collectionId) => ipcRenderer.invoke('collections:delete', collectionId),
    search: (profileId, query, tagIds) =>
      ipcRenderer.invoke('collections:search', profileId, query, tagIds),
    selectSourceFolders: () => ipcRenderer.invoke('collections:select-source-folders'),
    selectMediaFiles: () => ipcRenderer.invoke('collections:select-media-files'),
    previewSourceMedia: (sourcePath) =>
      ipcRenderer.invoke('collections:preview-source-media', sourcePath),
    addSource: (input) => ipcRenderer.invoke('collections:add-source', input),
    deleteSource: (sourceId) => ipcRenderer.invoke('collections:delete-source', sourceId),
    updateSources: (collectionId, sources) =>
      ipcRenderer.invoke('collections:update-sources', collectionId, sources),
    updateSourceMediaOrder: (input) =>
      ipcRenderer.invoke('collections:update-source-media-order', input),
    rescan: (collectionId) => ipcRenderer.invoke('collections:rescan', collectionId),
    rescanSource: (sourceId) => ipcRenderer.invoke('collections:rescan-source', sourceId),
    confirmPendingMedia: (collectionId) =>
      ipcRenderer.invoke('collections:confirm-pending-media', collectionId),
    addMedia: (input) =>
      ipcRenderer.invoke('collections:add-media', input.sourceId, input.filePaths),
    updateMedia: (collectionId, media) =>
      ipcRenderer.invoke('collections:update-media', collectionId, media),
    deleteMedia: (collectionId, mediaIds) =>
      ipcRenderer.invoke('collections:delete-media', collectionId, mediaIds),
    listTags: (profileId) => ipcRenderer.invoke('collections:list-tags', profileId),
    createTag: (profileId, name, color) =>
      ipcRenderer.invoke('collections:create-tag', profileId, name, color),
    deleteTag: (tagId) => ipcRenderer.invoke('collections:delete-tag', tagId),
    listMedia: (collectionId) => ipcRenderer.invoke('collections:list-media', collectionId),
    listSourceMedia: (sourceId) => ipcRenderer.invoke('collections:list-source-media', sourceId)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  ;(window as Window & typeof globalThis & { api: NexmpApi }).api = api
}
