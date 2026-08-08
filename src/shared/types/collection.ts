export type Collection = {
  id: string
  profileId: string
  name: string
  coverPath: string | null
  sortOrder: number
  rating: number
  isPinned: boolean
  createdAt: string
  updatedAt: string
}

export type SourceMediaOrder = 'custom' | 'name' | 'date'

export type CollectionSource = {
  id: string
  collectionId: string
  name: string
  sourcePath: string
  sortOrder: number
  mediaOrder: SourceMediaOrder
  isMissing: boolean
  isDynamic: boolean
  lastScannedAt: string | null
  createdAt: string
  updatedAt: string
}

export type CollectionWithSources = Collection & { sources: CollectionSource[] }
export type MediaFile = {
  id: string
  collectionSourceId: string
  collectionName: string
  sourceName: string
  sourcePath: string
  sourceIsDynamic: boolean
  sourceMediaOrder: SourceMediaOrder
  filePath: string
  filename: string
  extension: string
  sizeBytes: number
  sortOrder: number
  modifiedAt: string | null
  isMissing: boolean
  isPending: boolean
  url: string
}

export type Tag = {
  id: string
  profileId: string
  name: string
  color: string
  createdAt: string
  updatedAt: string
}

export type CollectionSearchResult = CollectionWithSources & {
  tags: Tag[]
  mediaForCollection?: MediaFile[]
}

export type SourceMediaPreview = {
  filePath: string
  filename: string
  extension: string
  sizeBytes: number
  url: string
}

export type CollectionSourceInput = {
  sourcePath: string
  name?: string
  isDynamic: boolean
  includedFilePaths?: string[]
}

export type CollectionThumbnailImageInput = {
  dataUrl: string
  originalName: string
  originalSizeBytes: number
  compressedSizeBytes: number
}

export type CreateCollectionInput = {
  profileId: string
  name: string
  sourcePaths: string[]
  sourceDynamic: boolean
  tagIds: string[]
  sources?: CollectionSourceInput[]
  coverImage?: CollectionThumbnailImageInput | null
}

export type UpdateCollectionInput = {
  id: string
  name?: string
  tagIds?: string[]
  rating?: number
  isPinned?: boolean
  coverImage?: CollectionThumbnailImageInput | null
  removeCover?: boolean
}

export type UpdateCollectionSourceInput = {
  id: string
  name: string
  sortOrder: number
  isDynamic?: boolean
  sourcePath?: string
  pendingAction?: 'ignore' | 'approve'
}

export type UpdateSourceMediaOrderInput = {
  sourceId: string
  mediaOrder: SourceMediaOrder
}

export type UpdateMediaFileInput = {
  id: string
  filename: string
  sortOrder: number
}

export type AddCollectionSourceInput = CollectionSourceInput & {
  collectionId: string
}

export type AddSourceMediaInput = {
  sourceId: string
  filePaths: string[]
}

export type UpdateSourcePendingMediaInput = {
  sourceId: string
  mediaIds?: string[]
}

export type ChangeSourcePathInput = {
  sourceId: string
  sourcePath: string
}

export type CollectionApi = {
  list: (profileId: string) => Promise<CollectionWithSources[]>
  create: (input: CreateCollectionInput) => Promise<CollectionWithSources>
  update: (input: UpdateCollectionInput) => Promise<CollectionWithSources>
  delete: (collectionId: string) => Promise<void>
  search: (profileId: string, query: string, tagIds: string[]) => Promise<CollectionSearchResult[]>
  selectSourceFolders: () => Promise<string[]>
  selectMediaFiles: () => Promise<string[]>
  previewSourceMedia: (sourcePath: string) => Promise<SourceMediaPreview[]>
  addSource: (input: AddCollectionSourceInput) => Promise<CollectionWithSources>
  deleteSource: (sourceId: string) => Promise<CollectionWithSources>
  updateSources: (
    collectionId: string,
    sources: UpdateCollectionSourceInput[]
  ) => Promise<CollectionWithSources>
  changeSourcePath: (input: ChangeSourcePathInput) => Promise<MediaFile[]>
  showSourceInExplorer: (sourceId: string) => Promise<void>
  updateSourceMediaOrder: (input: UpdateSourceMediaOrderInput) => Promise<CollectionWithSources>
  rescan: (collectionId: string) => Promise<MediaFile[]>
  rescanSource: (sourceId: string) => Promise<MediaFile[]>
  refreshSourceMediaAvailability: (sourceId: string) => Promise<MediaFile[]>
  confirmPendingMedia: (collectionId: string) => Promise<MediaFile[]>
  approveSourcePendingMedia: (input: UpdateSourcePendingMediaInput) => Promise<MediaFile[]>
  rejectSourcePendingMedia: (input: UpdateSourcePendingMediaInput) => Promise<MediaFile[]>
  addMedia: (input: AddSourceMediaInput) => Promise<MediaFile[]>
  updateMedia: (collectionId: string, media: UpdateMediaFileInput[]) => Promise<MediaFile[]>
  deleteMedia: (collectionId: string, mediaIds: string[]) => Promise<MediaFile[]>
  listTags: (profileId: string) => Promise<Tag[]>
  createTag: (profileId: string, name: string, color: string) => Promise<Tag>
  updateTag: (tagId: string, name: string, color: string) => Promise<Tag>
  deleteTag: (tagId: string) => Promise<void>
  listMedia: (collectionId: string) => Promise<MediaFile[]>
  listSourceMedia: (sourceId: string) => Promise<MediaFile[]>
}
