import { contextBridge, ipcRenderer } from 'electron'
import type { NexmpApi } from '../shared/types/media'

const api: NexmpApi = {
  media: {
    openVideo: () => ipcRenderer.invoke('media:open-video'),
    startEmbeddedMpv: (input) => ipcRenderer.invoke('media:mpv-start', input),
    updateEmbeddedMpvBounds: (bounds) => ipcRenderer.invoke('media:mpv-update-bounds', bounds),
    setEmbeddedMpvPaused: (paused) => ipcRenderer.invoke('media:mpv-set-paused', paused),
    seekEmbeddedMpv: (seconds) => ipcRenderer.invoke('media:mpv-seek', seconds),
    setEmbeddedMpvVolume: (volume) => ipcRenderer.invoke('media:mpv-set-volume', volume),
    setEmbeddedMpvPlaybackRate: (playbackRate) =>
      ipcRenderer.invoke('media:mpv-set-playback-rate', playbackRate),
    setEmbeddedMpvAspectRatio: (aspectRatio) =>
      ipcRenderer.invoke('media:mpv-set-aspect-ratio', aspectRatio),
    setEmbeddedMpvSubtitlesVisible: (isVisible) =>
      ipcRenderer.invoke('media:mpv-set-subtitles-visible', isVisible),
    getEmbeddedMpvState: () => ipcRenderer.invoke('media:mpv-get-state'),
    stopEmbeddedMpv: () => ipcRenderer.invoke('media:mpv-stop'),
    listSubtitles: (videoPath, options) =>
      ipcRenderer.invoke('media:list-subtitles', videoPath, options),
    savePlaybackProgress: (input) => ipcRenderer.invoke('media:save-playback-progress', input),
    savePlaybackSession: (input) => ipcRenderer.invoke('media:save-playback-session', input),
    listContinueWatching: (profileId) =>
      ipcRenderer.invoke('media:list-continue-watching', profileId),
    clearContinueWatching: (profileId) =>
      ipcRenderer.invoke('media:clear-continue-watching', profileId)
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    create: (input) => ipcRenderer.invoke('profiles:create', input),
    update: (input) => ipcRenderer.invoke('profiles:update', input)
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
    changeSourcePath: (input) => ipcRenderer.invoke('collections:change-source-path', input),
    showSourceInExplorer: (sourceId) =>
      ipcRenderer.invoke('collections:show-source-in-explorer', sourceId),
    updateSourceMediaOrder: (input) =>
      ipcRenderer.invoke('collections:update-source-media-order', input),
    rescan: (collectionId) => ipcRenderer.invoke('collections:rescan', collectionId),
    rescanSource: (sourceId) => ipcRenderer.invoke('collections:rescan-source', sourceId),
    refreshSourceMediaAvailability: (sourceId) =>
      ipcRenderer.invoke('collections:refresh-source-media-availability', sourceId),
    confirmPendingMedia: (collectionId) =>
      ipcRenderer.invoke('collections:confirm-pending-media', collectionId),
    approveSourcePendingMedia: (input) =>
      ipcRenderer.invoke('collections:approve-source-pending-media', input),
    rejectSourcePendingMedia: (input) =>
      ipcRenderer.invoke('collections:reject-source-pending-media', input),
    addMedia: (input) =>
      ipcRenderer.invoke('collections:add-media', input.sourceId, input.filePaths),
    updateMedia: (collectionId, media) =>
      ipcRenderer.invoke('collections:update-media', collectionId, media),
    deleteMedia: (collectionId, mediaIds) =>
      ipcRenderer.invoke('collections:delete-media', collectionId, mediaIds),
    listTags: (profileId) => ipcRenderer.invoke('collections:list-tags', profileId),
    createTag: (profileId, name, color) =>
      ipcRenderer.invoke('collections:create-tag', profileId, name, color),
    updateTag: (tagId, name, color) =>
      ipcRenderer.invoke('collections:update-tag', tagId, name, color),
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
