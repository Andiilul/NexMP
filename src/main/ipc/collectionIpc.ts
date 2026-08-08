import { ipcMain, shell } from 'electron'
import type {
  AddCollectionSourceInput,
  ChangeSourcePathInput,
  CreateCollectionInput,
  UpdateCollectionInput,
  UpdateCollectionSourceInput,
  UpdateSourcePendingMediaInput,
  UpdateSourceMediaOrderInput,
  UpdateMediaFileInput
} from '../../shared/types/collection'
import {
  addCollectionSource,
  addSourceMedia,
  approveSourcePendingMedia,
  changeSourcePath,
  confirmPendingMedia,
  createCollection,
  createTag,
  deleteCollection,
  deleteCollectionSource,
  deleteTag,
  deleteMediaFiles,
  getCollectionSourcePath,
  listCollections,
  listTags,
  listCollectionMedia,
  listSourceMedia,
  previewSourceMedia,
  refreshSourceMediaAvailability,
  rejectSourcePendingMedia,
  rescanCollection,
  rescanCollectionSource,
  searchCollections,
  updateCollection,
  updateCollectionSourceMediaOrder,
  updateCollectionSources,
  updateTag,
  updateMediaFiles
} from '../services/collectionService'
import { showModalOpenDialog } from '../dialogs/modalOpenDialog'

const videoExtensions = ['mp4', 'mkv', 'webm', 'mov', 'avi', 'm4v']

export function registerCollectionIpc(): void {
  ipcMain.handle('collections:list', (_event, profileId: string) => listCollections(profileId))
  ipcMain.handle('collections:create', (_event, input: CreateCollectionInput) =>
    createCollection(input)
  )
  ipcMain.handle('collections:update', (_event, input: UpdateCollectionInput) =>
    updateCollection(input)
  )
  ipcMain.handle('collections:delete', (_event, collectionId: string) =>
    deleteCollection(collectionId)
  )
  ipcMain.handle('collections:select-source-folders', async (event) => {
    const result = await showModalOpenDialog(event.sender, 'collections:select-source-folders', {
      title: 'Select source folders',
      properties: ['openDirectory', 'multiSelections']
    })

    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle('collections:select-media-files', async (event) => {
    const result = await showModalOpenDialog(event.sender, 'collections:select-media-files', {
      title: 'Select videos',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Video files', extensions: videoExtensions },
        { name: 'All files', extensions: ['*'] }
      ]
    })

    return result.canceled ? [] : result.filePaths
  })
  ipcMain.handle('collections:preview-source-media', (_event, sourcePath: string) =>
    previewSourceMedia(sourcePath)
  )
  ipcMain.handle('collections:add-source', (_event, input: AddCollectionSourceInput) =>
    addCollectionSource(input)
  )
  ipcMain.handle('collections:delete-source', (_event, sourceId: string) =>
    deleteCollectionSource(sourceId)
  )
  ipcMain.handle(
    'collections:update-sources',
    (_event, collectionId: string, sources: UpdateCollectionSourceInput[]) =>
      updateCollectionSources(collectionId, sources)
  )
  ipcMain.handle('collections:change-source-path', (_event, input: ChangeSourcePathInput) =>
    changeSourcePath(input)
  )
  ipcMain.handle('collections:show-source-in-explorer', (_event, sourceId: string) => {
    shell.showItemInFolder(getCollectionSourcePath(sourceId))
  })
  ipcMain.handle(
    'collections:update-source-media-order',
    (_event, input: UpdateSourceMediaOrderInput) => updateCollectionSourceMediaOrder(input)
  )
  ipcMain.handle('collections:rescan', (_event, collectionId: string) =>
    rescanCollection(collectionId)
  )
  ipcMain.handle('collections:rescan-source', (_event, sourceId: string) =>
    rescanCollectionSource(sourceId)
  )
  ipcMain.handle('collections:refresh-source-media-availability', (_event, sourceId: string) =>
    refreshSourceMediaAvailability(sourceId)
  )
  ipcMain.handle('collections:confirm-pending-media', (_event, collectionId: string) =>
    confirmPendingMedia(collectionId)
  )
  ipcMain.handle(
    'collections:approve-source-pending-media',
    (_event, input: UpdateSourcePendingMediaInput) => approveSourcePendingMedia(input)
  )
  ipcMain.handle(
    'collections:reject-source-pending-media',
    (_event, input: UpdateSourcePendingMediaInput) => rejectSourcePendingMedia(input)
  )
  ipcMain.handle('collections:add-media', (_event, sourceId: string, filePaths: string[]) =>
    addSourceMedia(sourceId, filePaths)
  )
  ipcMain.handle(
    'collections:update-media',
    (_event, collectionId: string, media: UpdateMediaFileInput[]) =>
      updateMediaFiles(collectionId, media)
  )
  ipcMain.handle('collections:delete-media', (_event, collectionId: string, mediaIds: string[]) =>
    deleteMediaFiles(collectionId, mediaIds)
  )
  ipcMain.handle(
    'collections:search',
    (_event, profileId: string, query: string, tagIds: string[]) =>
      searchCollections(profileId, query, tagIds)
  )
  ipcMain.handle('collections:list-tags', (_event, profileId: string) => listTags(profileId))
  ipcMain.handle('collections:list-media', (_event, collectionId: string) =>
    listCollectionMedia(collectionId)
  )
  ipcMain.handle('collections:list-source-media', (_event, sourceId: string) =>
    listSourceMedia(sourceId)
  )
  ipcMain.handle(
    'collections:create-tag',
    (_event, profileId: string, name: string, color: string) => createTag(profileId, name, color)
  )
  ipcMain.handle('collections:update-tag', (_event, tagId: string, name: string, color: string) =>
    updateTag(tagId, name, color)
  )
  ipcMain.handle('collections:delete-tag', (_event, tagId: string) => deleteTag(tagId))
}
