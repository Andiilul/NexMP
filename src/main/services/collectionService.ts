import { randomUUID } from 'node:crypto'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { asc, eq } from 'drizzle-orm'
import type {
  AddCollectionSourceInput,
  CollectionSearchResult,
  CollectionSourceInput,
  CollectionWithSources,
  CreateCollectionInput,
  MediaFile,
  SourceMediaOrder,
  SourceMediaPreview,
  Tag,
  UpdateCollectionInput,
  UpdateCollectionSourceInput,
  UpdateSourceMediaOrderInput,
  UpdateMediaFileInput
} from '../../shared/types/collection'
import { getDatabase } from '../database'
import {
  collectionTags,
  collections,
  collectionSources,
  mediaFiles,
  profiles,
  tags
} from '../database/schema'
import { createMediaProtocolUrl } from '../media/mediaProtocol'

const supportedMediaExtensions = new Set(['.mp4', '.mkv', '.webm', '.mov', '.avi', '.m4v'])
const sourceMediaOrders = new Set<SourceMediaOrder>(['custom', 'name', 'date'])

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

function normalizeSourceMediaOrder(mediaOrder: string): SourceMediaOrder {
  return sourceMediaOrders.has(mediaOrder as SourceMediaOrder)
    ? (mediaOrder as SourceMediaOrder)
    : 'name'
}

function compareMediaName(
  firstMedia: Pick<MediaFile, 'filename'>,
  secondMedia: Pick<MediaFile, 'filename'>
): number {
  return firstMedia.filename.localeCompare(secondMedia.filename, undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

function getMediaDateValue(media: Pick<MediaFile, 'modifiedAt'>): number {
  if (!media.modifiedAt) return 0

  const value = new Date(media.modifiedAt).getTime()
  return Number.isFinite(value) ? value : 0
}

function getCollectionWithSources(collectionId: string): CollectionWithSources {
  const database = getDatabase()
  const collection = database
    .select()
    .from(collections)
    .where(eq(collections.id, collectionId))
    .get()
  if (!collection) throw new Error('Collection not found.')

  return {
    ...collection,
    sources: database
      .select()
      .from(collectionSources)
      .where(eq(collectionSources.collectionId, collectionId))
      .orderBy(asc(collectionSources.sortOrder))
      .all()
  }
}

function getSourceCollectionId(sourceId: string): string {
  const source = getDatabase()
    .select({ collectionId: collectionSources.collectionId })
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .get()
  if (!source) throw new Error('Source not found.')

  return source.collectionId
}

function normalizeSourceInputs(input: CreateCollectionInput): CollectionSourceInput[] {
  if (input.sources && input.sources.length > 0) {
    return input.sources
      .map((source) => ({
        ...source,
        sourcePath: source.sourcePath.trim(),
        name: normalizeName(source.name ?? basename(source.sourcePath))
      }))
      .filter((source) => source.sourcePath)
  }

  return [...new Set(input.sourcePaths.map((path) => path.trim()).filter(Boolean))].map(
    (sourcePath) => ({
      sourcePath,
      name: basename(sourcePath),
      isDynamic: input.sourceDynamic
    })
  )
}

export function listCollections(profileId: string): CollectionWithSources[] {
  const database = getDatabase()
  const profileCollections = database
    .select()
    .from(collections)
    .where(eq(collections.profileId, profileId))
    .orderBy(asc(collections.sortOrder), asc(collections.createdAt))
    .all()

  return profileCollections.map((collection) => ({
    ...collection,
    sources: database
      .select()
      .from(collectionSources)
      .where(eq(collectionSources.collectionId, collection.id))
      .orderBy(asc(collectionSources.sortOrder))
      .all()
  }))
}

export function createCollection(input: CreateCollectionInput): CollectionWithSources {
  const name = normalizeName(input.name ?? '')
  const sourceInputs = normalizeSourceInputs(input)
  const tagIds = [...new Set(input.tagIds ?? [])]

  if (!name) throw new Error('Collection name is required.')
  if (name.length > 80) throw new Error('Collection name can be at most 80 characters.')

  const database = getDatabase()
  const profile = database
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, input.profileId))
    .get()
  if (!profile) throw new Error('The selected profile no longer exists.')

  const id = randomUUID()
  const sortOrder = listCollections(input.profileId).length
  const createdSources: Array<{ id: string; input: CollectionSourceInput }> = []

  database.transaction(() => {
    database.insert(collections).values({ id, profileId: input.profileId, name, sortOrder }).run()
    sourceInputs.forEach((sourceInput, index) => {
      const sourceId = randomUUID()
      createdSources.push({ id: sourceId, input: sourceInput })
      database
        .insert(collectionSources)
        .values({
          id: sourceId,
          collectionId: id,
          name: normalizeName(sourceInput.name ?? basename(sourceInput.sourcePath)),
          sourcePath: sourceInput.sourcePath,
          sortOrder: index,
          isDynamic: sourceInput.isDynamic
        })
        .run()
    })
    tagIds.forEach((tagId) => {
      database.insert(collectionTags).values({ collectionId: id, tagId }).run()
    })
  })

  for (const source of createdSources) importInitialSourceMedia(source.id, source.input)

  return getCollectionWithSources(id)
}

function findMediaFiles(sourcePath: string): string[] {
  const files: string[] = []
  const visit = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const filePath = join(directory, entry.name)
      if (entry.isDirectory()) visit(filePath)
      if (entry.isFile() && supportedMediaExtensions.has(extname(entry.name).toLocaleLowerCase())) {
        files.push(filePath)
      }
    }
  }
  visit(sourcePath)
  return files.sort((firstPath, secondPath) =>
    firstPath.localeCompare(secondPath, undefined, { numeric: true, sensitivity: 'base' })
  )
}

export function previewSourceMedia(sourcePath: string): SourceMediaPreview[] {
  const normalizedSourcePath = sourcePath.trim()
  if (!normalizedSourcePath) throw new Error('Source folder is required.')
  if (!existsSync(normalizedSourcePath)) throw new Error('Source folder does not exist.')

  return findMediaFiles(normalizedSourcePath).map((filePath) => {
    const stats = statSync(filePath)
    const filename = basename(filePath)

    return {
      filePath,
      filename,
      extension: extname(filename).slice(1).toLocaleLowerCase(),
      sizeBytes: stats.size
    }
  })
}

function insertMediaFiles(sourceId: string, filePaths: string[], isPending: boolean): void {
  const database = getDatabase()
  const source = database
    .select({ id: collectionSources.id })
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .get()
  if (!source) throw new Error('Source not found.')

  const knownMedia = database
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.collectionSourceId, sourceId))
    .all()
  const knownPaths = new Set(knownMedia.map((media) => media.filePath))
  let nextSortOrder = knownMedia.length

  for (const filePath of filePaths) {
    const extension = extname(filePath).toLocaleLowerCase()
    if (!supportedMediaExtensions.has(extension)) continue
    if (knownPaths.has(filePath)) continue

    const existingMedia = database
      .select({ id: mediaFiles.id })
      .from(mediaFiles)
      .where(eq(mediaFiles.filePath, filePath))
      .get()
    if (existingMedia) continue

    const stats = statSync(filePath)
    const filename = basename(filePath)
    database
      .insert(mediaFiles)
      .values({
        id: randomUUID(),
        collectionSourceId: sourceId,
        filePath,
        filename,
        extension: extname(filename).slice(1).toLocaleLowerCase(),
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        sortOrder: nextSortOrder,
        isPending
      })
      .run()
    knownPaths.add(filePath)
    nextSortOrder += 1
  }
}

function importInitialSourceMedia(sourceId: string, sourceInput: CollectionSourceInput): void {
  const database = getDatabase()
  const source = database
    .select()
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .get()
  if (!source) throw new Error('Source not found.')

  const scannedAt = new Date().toISOString()
  if (!existsSync(source.sourcePath)) {
    database
      .update(collectionSources)
      .set({ isMissing: true, lastScannedAt: scannedAt, updatedAt: scannedAt })
      .where(eq(collectionSources.id, sourceId))
      .run()
    return
  }

  const selectedPaths = sourceInput.isDynamic
    ? findMediaFiles(source.sourcePath)
    : (sourceInput.includedFilePaths ?? findMediaFiles(source.sourcePath))

  insertMediaFiles(sourceId, selectedPaths, false)
  database
    .update(collectionSources)
    .set({ isMissing: false, lastScannedAt: scannedAt, updatedAt: scannedAt })
    .where(eq(collectionSources.id, sourceId))
    .run()
}

/** Keeps a source's known media in sync without deleting unavailable history. */
export type NewMediaCandidate = SourceMediaPreview

export function scanCollectionSource(sourceId: string): NewMediaCandidate[] {
  const database = getDatabase()
  const source = database
    .select()
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .get()
  if (!source) throw new Error('Source not found.')

  const knownMedia = database
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.collectionSourceId, sourceId))
    .all()
  const scannedAt = new Date().toISOString()

  if (!existsSync(source.sourcePath)) {
    database
      .update(collectionSources)
      .set({ isMissing: true, lastScannedAt: scannedAt, updatedAt: scannedAt })
      .where(eq(collectionSources.id, sourceId))
      .run()
    for (const media of knownMedia) {
      database
        .update(mediaFiles)
        .set({ isMissing: true, updatedAt: scannedAt })
        .where(eq(mediaFiles.id, media.id))
        .run()
    }
    return []
  }

  const availablePaths = new Set(findMediaFiles(source.sourcePath))
  database
    .update(collectionSources)
    .set({ isMissing: false, lastScannedAt: scannedAt, updatedAt: scannedAt })
    .where(eq(collectionSources.id, sourceId))
    .run()

  for (const media of knownMedia) {
    const isMissing = !availablePaths.has(media.filePath)
    database
      .update(mediaFiles)
      .set({ isMissing, updatedAt: scannedAt })
      .where(eq(mediaFiles.id, media.id))
      .run()
  }

  if (!source.isDynamic) return []

  const knownPaths = new Set(knownMedia.map((media) => media.filePath))
  const candidates = previewSourceMedia(source.sourcePath).filter(
    (candidate) => !knownPaths.has(candidate.filePath)
  )
  insertMediaFiles(
    sourceId,
    candidates.map((candidate) => candidate.filePath),
    true
  )

  return candidates
}

export function listTags(profileId: string): Tag[] {
  return getDatabase()
    .select()
    .from(tags)
    .where(eq(tags.profileId, profileId))
    .orderBy(asc(tags.name))
    .all()
}

export function listCollectionMedia(collectionId: string): MediaFile[] {
  const database = getDatabase()
  const mediaRows = database
    .select({
      id: mediaFiles.id,
      collectionSourceId: mediaFiles.collectionSourceId,
      collectionName: collections.name,
      sourceName: collectionSources.name,
      sourcePath: collectionSources.sourcePath,
      sourceIsDynamic: collectionSources.isDynamic,
      sourceMediaOrder: collectionSources.mediaOrder,
      sourceSortOrder: collectionSources.sortOrder,
      filePath: mediaFiles.filePath,
      filename: mediaFiles.filename,
      extension: mediaFiles.extension,
      sizeBytes: mediaFiles.sizeBytes,
      modifiedAt: mediaFiles.modifiedAt,
      isMissing: mediaFiles.isMissing,
      isPending: mediaFiles.isPending,
      mediaSortOrder: mediaFiles.sortOrder
    })
    .from(mediaFiles)
    .innerJoin(collectionSources, eq(mediaFiles.collectionSourceId, collectionSources.id))
    .innerJoin(collections, eq(collectionSources.collectionId, collections.id))
    .where(eq(collectionSources.collectionId, collectionId))
    .orderBy(asc(collectionSources.sortOrder), asc(mediaFiles.sortOrder))
    .all()

  return mediaRows
    .sort((firstMedia, secondMedia) => {
      const sourceComparison = firstMedia.sourceSortOrder - secondMedia.sourceSortOrder
      if (sourceComparison !== 0) return sourceComparison

      const mediaOrder = normalizeSourceMediaOrder(firstMedia.sourceMediaOrder)
      if (mediaOrder === 'date') {
        return (
          getMediaDateValue(secondMedia) - getMediaDateValue(firstMedia) ||
          compareMediaName(firstMedia, secondMedia) ||
          firstMedia.mediaSortOrder - secondMedia.mediaSortOrder
        )
      }
      if (mediaOrder === 'name') {
        return (
          compareMediaName(firstMedia, secondMedia) ||
          firstMedia.mediaSortOrder - secondMedia.mediaSortOrder
        )
      }

      return (
        firstMedia.mediaSortOrder - secondMedia.mediaSortOrder ||
        compareMediaName(firstMedia, secondMedia)
      )
    })
    .map((media) => ({
      id: media.id,
      collectionSourceId: media.collectionSourceId,
      collectionName: media.collectionName,
      sourceName: media.sourceName,
      sourcePath: media.sourcePath,
      sourceIsDynamic: media.sourceIsDynamic,
      sourceMediaOrder: normalizeSourceMediaOrder(media.sourceMediaOrder),
      filePath: media.filePath,
      filename: media.filename,
      extension: media.extension,
      sizeBytes: media.sizeBytes,
      modifiedAt: media.modifiedAt,
      isMissing: media.isMissing,
      isPending: media.isPending,
      url: createMediaProtocolUrl(media.filePath)
    }))
}

export function listSourceMedia(sourceId: string): MediaFile[] {
  const collectionId = getSourceCollectionId(sourceId)

  return listCollectionMedia(collectionId).filter((media) => media.collectionSourceId === sourceId)
}

export function rescanCollection(collectionId: string): MediaFile[] {
  const database = getDatabase()
  const sources = database
    .select({ id: collectionSources.id })
    .from(collectionSources)
    .where(eq(collectionSources.collectionId, collectionId))
    .all()

  for (const source of sources) scanCollectionSource(source.id)

  return listCollectionMedia(collectionId)
}

export function rescanCollectionSource(sourceId: string): MediaFile[] {
  const collectionId = getSourceCollectionId(sourceId)
  const source = getDatabase()
    .select({ isDynamic: collectionSources.isDynamic })
    .from(collectionSources)
    .where(eq(collectionSources.id, sourceId))
    .get()
  if (!source) throw new Error('Source not found.')
  if (!source.isDynamic) throw new Error('Static sources cannot be rescanned for new files.')

  scanCollectionSource(sourceId)

  return listCollectionMedia(collectionId)
}

export function confirmPendingMedia(collectionId: string): MediaFile[] {
  const pendingMedia = listCollectionMedia(collectionId).filter((media) => media.isPending)
  const database = getDatabase()

  for (const media of pendingMedia) {
    database
      .update(mediaFiles)
      .set({ isPending: false, updatedAt: new Date().toISOString() })
      .where(eq(mediaFiles.id, media.id))
      .run()
  }

  return listCollectionMedia(collectionId)
}

export function addCollectionSource(input: AddCollectionSourceInput): CollectionWithSources {
  const sourcePath = input.sourcePath.trim()
  if (!sourcePath) throw new Error('Source folder is required.')

  const database = getDatabase()
  const collection = database
    .select({ id: collections.id })
    .from(collections)
    .where(eq(collections.id, input.collectionId))
    .get()
  if (!collection) throw new Error('Collection not found.')

  const existingSources = database
    .select()
    .from(collectionSources)
    .where(eq(collectionSources.collectionId, input.collectionId))
    .orderBy(asc(collectionSources.sortOrder))
    .all()
  const sourceId = randomUUID()

  database
    .insert(collectionSources)
    .values({
      id: sourceId,
      collectionId: input.collectionId,
      name: normalizeName(input.name ?? basename(sourcePath)),
      sourcePath,
      sortOrder: existingSources.length,
      isDynamic: input.isDynamic
    })
    .run()

  importInitialSourceMedia(sourceId, input)
  return getCollectionWithSources(input.collectionId)
}

export function deleteCollectionSource(sourceId: string): CollectionWithSources {
  const collectionId = getSourceCollectionId(sourceId)
  const database = getDatabase()
  database.delete(collectionSources).where(eq(collectionSources.id, sourceId)).run()

  const remainingSources = database
    .select()
    .from(collectionSources)
    .where(eq(collectionSources.collectionId, collectionId))
    .orderBy(asc(collectionSources.sortOrder))
    .all()
  remainingSources.forEach((source, sortOrder) => {
    database
      .update(collectionSources)
      .set({ sortOrder, updatedAt: new Date().toISOString() })
      .where(eq(collectionSources.id, source.id))
      .run()
  })

  return getCollectionWithSources(collectionId)
}

export function addSourceMedia(sourceId: string, filePaths: string[]): MediaFile[] {
  const collectionId = getSourceCollectionId(sourceId)
  insertMediaFiles(sourceId, filePaths, false)

  return listCollectionMedia(collectionId)
}

export function updateCollection(input: UpdateCollectionInput): CollectionWithSources {
  const database = getDatabase()
  const collection = database.select().from(collections).where(eq(collections.id, input.id)).get()
  if (!collection) throw new Error('Collection not found.')
  const updatedAt = new Date().toISOString()

  if (input.name !== undefined) {
    const name = normalizeName(input.name)
    if (!name) throw new Error('Collection name is required.')
    if (name.length > 80) throw new Error('Collection name can be at most 80 characters.')
    database.update(collections).set({ name, updatedAt }).where(eq(collections.id, input.id)).run()
  }

  if (input.rating !== undefined) {
    const rating = Math.min(Math.max(Math.trunc(input.rating), 0), 10)
    database
      .update(collections)
      .set({ rating, updatedAt })
      .where(eq(collections.id, input.id))
      .run()
  }

  if (input.isPinned !== undefined) {
    database
      .update(collections)
      .set({ isPinned: input.isPinned, updatedAt })
      .where(eq(collections.id, input.id))
      .run()
  }

  if (input.tagIds) {
    const nextTagIds = [...new Set(input.tagIds)]
    database.transaction(() => {
      database.delete(collectionTags).where(eq(collectionTags.collectionId, input.id)).run()
      nextTagIds.forEach((tagId) => {
        database.insert(collectionTags).values({ collectionId: input.id, tagId }).run()
      })
    })
  }

  return getCollectionWithSources(input.id)
}

export function updateCollectionSources(
  collectionId: string,
  sourceInputs: UpdateCollectionSourceInput[]
): CollectionWithSources {
  const database = getDatabase()
  const sourceIds = new Set(
    database
      .select({ id: collectionSources.id })
      .from(collectionSources)
      .where(eq(collectionSources.collectionId, collectionId))
      .all()
      .map((source) => source.id)
  )

  for (const sourceInput of sourceInputs) {
    if (!sourceIds.has(sourceInput.id)) throw new Error('Source not found in this collection.')
    const name = normalizeName(sourceInput.name)
    if (!name) throw new Error('Source name is required.')
    database
      .update(collectionSources)
      .set({
        name,
        sortOrder: sourceInput.sortOrder,
        updatedAt: new Date().toISOString()
      })
      .where(eq(collectionSources.id, sourceInput.id))
      .run()
  }

  return getCollectionWithSources(collectionId)
}

export function updateCollectionSourceMediaOrder(
  input: UpdateSourceMediaOrderInput
): CollectionWithSources {
  const database = getDatabase()
  const source = database
    .select({ collectionId: collectionSources.collectionId })
    .from(collectionSources)
    .where(eq(collectionSources.id, input.sourceId))
    .get()
  if (!source) throw new Error('Source not found.')

  const mediaOrder = normalizeSourceMediaOrder(input.mediaOrder)
  database
    .update(collectionSources)
    .set({
      mediaOrder,
      updatedAt: new Date().toISOString()
    })
    .where(eq(collectionSources.id, input.sourceId))
    .run()

  return getCollectionWithSources(source.collectionId)
}

export function updateMediaFiles(
  collectionId: string,
  mediaInputs: UpdateMediaFileInput[]
): MediaFile[] {
  const database = getDatabase()
  const mediaIds = new Set(listCollectionMedia(collectionId).map((media) => media.id))

  for (const mediaInput of mediaInputs) {
    if (!mediaIds.has(mediaInput.id)) throw new Error('Media file not found in this collection.')
    const filename = normalizeName(mediaInput.filename)
    if (!filename) throw new Error('Media filename is required.')
    database
      .update(mediaFiles)
      .set({
        filename,
        sortOrder: mediaInput.sortOrder,
        updatedAt: new Date().toISOString()
      })
      .where(eq(mediaFiles.id, mediaInput.id))
      .run()
  }

  return listCollectionMedia(collectionId)
}

export function deleteCollection(collectionId: string): void {
  getDatabase().delete(collections).where(eq(collections.id, collectionId)).run()
}

export function createTag(profileId: string, name: string, color: string): Tag {
  const normalizedName = normalizeName(name)
  if (!normalizedName) throw new Error('Tag name is required.')
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('A valid tag color is required.')
  const database = getDatabase()
  const profile = database
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .get()
  if (!profile) throw new Error('The selected profile no longer exists.')

  const id = randomUUID()
  database.insert(tags).values({ id, profileId, name: normalizedName, color }).run()
  const tag = database.select().from(tags).where(eq(tags.id, id)).get()
  if (!tag) throw new Error('Could not create tag.')
  return tag
}

export function searchCollections(
  profileId: string,
  query: string,
  tagIds: string[]
): CollectionSearchResult[] {
  const database = getDatabase()
  const normalizedQuery = query.trim().toLocaleLowerCase()
  const selectedTagIds = new Set(tagIds)

  return listCollections(profileId)
    .map((collection) => {
      const mediaForCollection = listCollectionMedia(collection.id)
      const tagsForCollection = database
        .select()
        .from(collectionTags)
        .innerJoin(tags, eq(collectionTags.tagId, tags.id))
        .where(eq(collectionTags.collectionId, collection.id))
        .all()
        .map((row) => row.tags)
      return { ...collection, tags: tagsForCollection, mediaForCollection }
    })
    .filter((collection) => {
      const searchableText = [
        collection.name,
        ...collection.sources.map((source) => source.name),
        ...collection.mediaForCollection.map((media) => media.filename)
      ].join(' ')
      return (
        (!normalizedQuery || searchableText.toLocaleLowerCase().includes(normalizedQuery)) &&
        (selectedTagIds.size === 0 || collection.tags.some((tag) => selectedTagIds.has(tag.id)))
      )
    })
}
