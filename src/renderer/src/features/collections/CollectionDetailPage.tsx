import {
  ArrowLeft,
  Check,
  ChevronDown,
  FilePlus,
  FolderOpen,
  Play,
  Settings,
  Trash2,
  X
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  CollectionSource,
  CollectionWithSources,
  MediaFile,
  SourceMediaOrder,
  SourceMediaPreview,
  Tag
} from '../../../../shared/types/collection'
import { ThumbnailPicker, type ThumbnailPickerValue } from '../../components/ThumbnailPicker'
import { useToast } from '../../components/useToast'
import { CollectionDataViewer } from './CollectionDataViewer'
import { createPlayablePlaylist, type PlayerRouteState } from './mediaPlayback'
import {
  MediaFilesViewer,
  type MediaEditDraft,
  type SmartRenameSaveInput
} from './MediaFilesViewer'
import { SourceCard } from './SourceCard'
import { VideoCard } from './VideoCard'
import { formatTagName } from '../tags/tagDisplay'

type SourceEditDraft = {
  id: string
  name: string
  sortOrder: number
  source: CollectionSource
}

type AddSourceDraft = {
  name: string
  sourcePath: string
  preview: SourceMediaPreview[]
  selectedFilePaths: string[]
  isDynamic: boolean
  isPreviewOpen: boolean
}

type CollectionDetail = CollectionWithSources & {
  tags: Tag[]
}

type SingleSourceMediaTab = 'videos' | 'pending' | 'missing'
const emptyThumbnailValue: ThumbnailPickerValue = {
  coverImage: null,
  previewUrl: null,
  removeCover: false
}

function getFolderName(sourcePath: string): string {
  const parts = sourcePath.split(/[\\/]/).filter(Boolean)
  return parts.at(-1) ?? sourcePath
}

export function CollectionDetailPage(): React.JSX.Element {
  const { collectionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { info, warning } = useToast()
  const [collection, setCollection] = useState<CollectionDetail | null>(null)
  const [availableTags, setAvailableTags] = useState<Tag[]>([])
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [editName, setEditName] = useState('')
  const [editTagIds, setEditTagIds] = useState<string[]>([])
  const [editThumbnail, setEditThumbnail] = useState<ThumbnailPickerValue>(emptyThumbnailValue)
  const [hasPendingThumbnail, setHasPendingThumbnail] = useState(false)
  const [editSources, setEditSources] = useState<SourceEditDraft[]>([])
  const [editMedia, setEditMedia] = useState<MediaEditDraft[]>([])
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [addSourceDrafts, setAddSourceDrafts] = useState<AddSourceDraft[]>([])
  const [singleSourceActiveTab, setSingleSourceActiveTab] = useState<SingleSourceMediaTab>('videos')
  const [isSingleMissingAlertOpen, setIsSingleMissingAlertOpen] = useState(false)
  const [isSingleDynamicOffConfirmOpen, setIsSingleDynamicOffConfirmOpen] = useState(false)
  const [shouldClearSinglePendingOnSave, setShouldClearSinglePendingOnSave] = useState(false)
  const hasShownSingleMissingAlertRef = useRef(false)
  const returnTo = `${location.pathname}${location.search}`

  const applyEditState = (
    nextCollection: CollectionDetail | null,
    nextMediaFiles: MediaFile[]
  ): void => {
    if (!nextCollection) return
    setEditName(nextCollection.name)
    setEditTagIds(nextCollection.tags.map((tag) => tag.id))
    setEditThumbnail({
      coverImage: null,
      previewUrl: nextCollection.coverPath,
      removeCover: false
    })
    setHasPendingThumbnail(false)
    setEditSources(
      nextCollection.sources.map((source, index) => ({
        id: source.id,
        name: source.name,
        sortOrder: index,
        source
      }))
    )
    setEditMedia(
      nextMediaFiles
        .filter((media) => !media.isMissing && !media.isPending)
        .map((media, index) => ({
          id: media.id,
          filename: media.filename,
          sortOrder: index,
          media
        }))
    )
  }

  const fetchCollection = useCallback(
    async (
      scanOnOpen = false
    ): Promise<{
      nextCollection: CollectionDetail | null
      nextMediaFiles: MediaFile[]
      nextTags: Tag[]
      newPendingMedia: MediaFile[]
    }> => {
      const profileId = sessionStorage.getItem('nexmp.active-profile-id')
      if (!profileId || !collectionId) {
        navigate('/home')
        return { nextCollection: null, nextMediaFiles: [], nextTags: [], newPendingMedia: [] }
      }

      const collectionApi = window.api?.collections
      if (!collectionApi)
        throw new Error('Collection service is unavailable. Please restart NexMP.')

      const [items, knownMediaFiles, nextTags] = await Promise.all([
        collectionApi.search(profileId, '', []),
        collectionApi.listMedia(collectionId),
        collectionApi.listTags(profileId)
      ])
      const knownPaths = new Set(knownMediaFiles.map((media) => media.filePath))
      const collectionBeforeScan = items.find((item) => item.id === collectionId) ?? null
      const nextMediaFiles =
        scanOnOpen && collectionBeforeScan
          ? await collectionApi.rescan(collectionId)
          : knownMediaFiles
      const nextItems =
        scanOnOpen && collectionBeforeScan ? await collectionApi.search(profileId, '', []) : items
      const newPendingMedia = nextMediaFiles.filter(
        (media) => media.isPending && !media.isMissing && !knownPaths.has(media.filePath)
      )

      return {
        nextCollection: nextItems.find((item) => item.id === collectionId) ?? null,
        nextMediaFiles,
        nextTags: nextTags ?? [],
        newPendingMedia
      }
    },
    [collectionId, navigate]
  )

  const reload = useCallback(async (): Promise<void> => {
    const { nextCollection, nextMediaFiles, nextTags } = await fetchCollection()
    setCollection(nextCollection)
    setAvailableTags(nextTags)
    setMediaFiles(nextMediaFiles)
    applyEditState(nextCollection, nextMediaFiles)
  }, [fetchCollection, info])

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        const { nextCollection, nextMediaFiles, nextTags, newPendingMedia } =
          await fetchCollection(true)
        if (!isMounted) return
        setCollection(nextCollection)
        setAvailableTags(nextTags)
        setMediaFiles(nextMediaFiles)
        applyEditState(nextCollection, nextMediaFiles)
        const nextSingleSource =
          nextCollection?.sources.length === 1 ? (nextCollection.sources[0] ?? null) : null
        const nextSingleMissingMedia = nextSingleSource
          ? nextMediaFiles.filter(
              (media) =>
                media.collectionSourceId === nextSingleSource.id &&
                media.isMissing &&
                !media.isPending
            )
          : []
        const nextSinglePendingMedia = nextSingleSource
          ? newPendingMedia.filter((media) => media.collectionSourceId === nextSingleSource.id)
          : []

        if (nextSinglePendingMedia.length > 0) {
          info(
            `Found ${nextSinglePendingMedia.length} new ${
              nextSinglePendingMedia.length === 1 ? 'video' : 'videos'
            }.`
          )
          setSingleSourceActiveTab('pending')
        } else if (
          !hasShownSingleMissingAlertRef.current &&
          nextSingleSource &&
          (nextSingleSource.isMissing || nextSingleMissingMedia.length > 0)
        ) {
          hasShownSingleMissingAlertRef.current = true
          setSingleSourceActiveTab('missing')
          setIsSingleMissingAlertOpen(true)
        }
      } catch (reason) {
        if (!isMounted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load this collection.')
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [fetchCollection])

  const playableMedia = mediaFiles.filter((media) => !media.isMissing && !media.isPending)
  const thumbnailVideoOptions = useMemo(
    () =>
      playableMedia.map((media) => ({
        id: media.id,
        name: media.filename,
        url: media.url,
        sizeBytes: media.sizeBytes
      })),
    [playableMedia]
  )
  const isSingleFolder = collection?.sources.length === 1
  const singleSource = collection?.sources[0] ?? null
  const singleSourceMedia = singleSource
    ? mediaFiles.filter((media) => media.collectionSourceId === singleSource.id)
    : []
  const singleSourceApprovedMedia = singleSourceMedia.filter(
    (media) => !media.isMissing && !media.isPending
  )
  const singleSourcePendingMedia = singleSource
    ? mediaFiles.filter(
        (media) =>
          media.collectionSourceId === singleSource.id && media.isPending && !media.isMissing
      )
    : []
  const singleSourceMissingMedia = singleSource
    ? mediaFiles.filter(
        (media) =>
          media.collectionSourceId === singleSource.id && media.isMissing && !media.isPending
      )
    : []
  const mediaCountBySource = mediaFiles.reduce<Record<string, number>>((counts, media) => {
    if (!media.isMissing && !media.isPending) {
      counts[media.collectionSourceId] = (counts[media.collectionSourceId] ?? 0) + 1
    }

    return counts
  }, {})
  const singleSourceDraft = singleSource
    ? (editSources.find((source) => source.id === singleSource.id) ?? null)
    : null
  const singleSourceIsDynamicDraft =
    singleSourceDraft?.source.isDynamic ?? singleSource?.isDynamic ?? true

  const setSingleSourceDynamicDraft = (isDynamic: boolean): void => {
    if (!singleSource) return

    if (singleSource.isDynamic && !isDynamic && singleSourcePendingMedia.length > 0) {
      setIsSingleDynamicOffConfirmOpen(true)
      return
    }

    setEditSources((current) =>
      current.map((source) =>
        source.id === singleSource.id
          ? { ...source, source: { ...source.source, isDynamic } }
          : source
      )
    )
    if (isDynamic) setShouldClearSinglePendingOnSave(false)
  }

  const confirmSingleSourceDynamicOff = (): void => {
    if (!singleSource) return

    setEditSources((current) =>
      current.map((source) =>
        source.id === singleSource.id
          ? { ...source, source: { ...source.source, isDynamic: false } }
          : source
      )
    )
    setShouldClearSinglePendingOnSave(true)
    setIsSingleDynamicOffConfirmOpen(false)
  }

  const toggleEditTag = (tagId: string): void => {
    setEditTagIds((currentTagIds) =>
      currentTagIds.includes(tagId)
        ? currentTagIds.filter((currentTagId) => currentTagId !== tagId)
        : [...currentTagIds, tagId]
    )
  }

  const updateCollectionRating = async (rating: number): Promise<void> => {
    if (!collectionId) return

    try {
      setError(null)
      const nextCollection = await window.api?.collections.update({ id: collectionId, rating })
      if (nextCollection) {
        setCollection((currentCollection) =>
          currentCollection ? { ...currentCollection, ...nextCollection } : null
        )
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update collection rating.')
    }
  }

  const playCollection = (): void => {
    const playlist = createPlayablePlaylist(mediaFiles)
    if (playlist.length === 0) {
      warning('This collection does not have playable videos yet.')
      return
    }

    navigate('/player', {
      state: {
        playlist,
        selectedIndex: 0,
        collectionName: collection?.name,
        returnTo
      } satisfies PlayerRouteState
    })
  }

  const playMedia = (media: MediaFile): void => {
    if (media.isMissing) {
      setError(`File not available: ${media.filePath}`)
      return
    }
    if (media.isPending) {
      setError('Confirm this new file before adding it to playback.')
      return
    }

    const playlist = createPlayablePlaylist(mediaFiles)
    const selectedIndex = Math.max(
      playlist.findIndex((video) => video.path === media.filePath),
      0
    )

    navigate('/player', {
      state: {
        playlist,
        selectedIndex,
        collectionName: collection?.name,
        returnTo
      } satisfies PlayerRouteState
    })
  }

  const moveSource = (sourceId: string, direction: -1 | 1): void => {
    setEditSources((current) => {
      const index = current.findIndex((source) => source.id === sourceId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [source] = next.splice(index, 1)
      if (!source) return current
      next.splice(targetIndex, 0, source)
      return next.map((item, sortOrder) => ({ ...item, sortOrder }))
    })
  }

  const removeSourceDraft = (sourceId: string): void => {
    setEditSources((current) =>
      current
        .filter((source) => source.id !== sourceId)
        .map((source, index) => ({ ...source, sortOrder: index }))
    )
  }

  const moveMedia = (mediaId: string, direction: -1 | 1): void => {
    setEditMedia((current) => {
      const index = current.findIndex((media) => media.id === mediaId)
      const targetIndex = index + direction
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current

      const next = [...current]
      const [media] = next.splice(index, 1)
      if (!media) return current
      next.splice(targetIndex, 0, media)
      return next.map((item, sortOrder) => ({ ...item, sortOrder }))
    })
  }

  const renameMediaDraft = (mediaId: string, filename: string): void => {
    setEditMedia((current) =>
      current.map((media) =>
        media.id === mediaId ? { ...media, filename, media: { ...media.media, filename } } : media
      )
    )
  }

  const saveMediaRename = async (mediaId: string, filename: string): Promise<void> => {
    if (!collectionId) return

    const baseMedia = [...singleSourceMedia].sort((firstMedia, secondMedia) => {
      return firstMedia.sortOrder - secondMedia.sortOrder
    })
    const nextMediaFiles = await window.api?.collections.updateMedia(
      collectionId,
      baseMedia.map((media) => ({
        id: media.id,
        filename: media.id === mediaId ? filename : media.filename,
        sortOrder: media.sortOrder
      }))
    )
    const nextFiles = nextMediaFiles ?? []
    setMediaFiles(nextFiles)
    applyEditState(collection, nextFiles)
  }

  const deleteMedia = async (mediaIds: string[]): Promise<void> => {
    if (!collectionId) return

    const nextMediaFiles = await window.api?.collections.deleteMedia(collectionId, mediaIds)
    const nextFiles = nextMediaFiles ?? []
    setMediaFiles(nextFiles)
    applyEditState(collection, nextFiles)
  }

  const approveSingleSourcePendingMedia = async (mediaIds?: string[]): Promise<void> => {
    if (!singleSource) return

    try {
      setIsSaving(true)
      setError(null)
      const nextCollectionMedia = await window.api?.collections.approveSourcePendingMedia({
        sourceId: singleSource.id,
        mediaIds
      })
      const nextFiles = nextCollectionMedia ?? []
      setMediaFiles(nextFiles)
      applyEditState(collection, nextFiles)
      setSingleSourceActiveTab('videos')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to approve pending videos.')
    } finally {
      setIsSaving(false)
    }
  }

  const rejectSingleSourcePendingMedia = async (mediaIds?: string[]): Promise<void> => {
    if (!singleSource) return

    try {
      setIsSaving(true)
      setError(null)
      const nextCollectionMedia = await window.api?.collections.rejectSourcePendingMedia({
        sourceId: singleSource.id,
        mediaIds
      })
      const nextFiles = nextCollectionMedia ?? []
      setMediaFiles(nextFiles)
      applyEditState(collection, nextFiles)
      if (
        nextFiles.filter(
          (media) =>
            media.collectionSourceId === singleSource.id && media.isPending && !media.isMissing
        ).length === 0
      ) {
        setSingleSourceActiveTab('videos')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reject pending videos.')
    } finally {
      setIsSaving(false)
    }
  }

  const updateSingleSourceMediaOrder = async (mediaOrder: SourceMediaOrder): Promise<void> => {
    if (!singleSource || !collectionId) return

    try {
      setError(null)
      const nextCollection = await window.api?.collections.updateSourceMediaOrder({
        sourceId: singleSource.id,
        mediaOrder
      })
      const nextMediaFiles = await window.api?.collections.listMedia(collectionId)
      const nextCollectionWithTags = nextCollection
        ? { ...nextCollection, tags: collection?.tags ?? [] }
        : collection

      setCollection(nextCollectionWithTags)
      setMediaFiles(nextMediaFiles ?? [])
      applyEditState(nextCollectionWithTags, nextMediaFiles ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update media order.')
    }
  }

  const saveSmartRename = async (renames: SmartRenameSaveInput[]): Promise<void> => {
    if (!collectionId) return

    const renameById = new Map(renames.map((rename) => [rename.id, rename.filename]))
    const baseMedia = isEditing
      ? editMedia
      : [...singleSourceMedia]
          .sort((firstMedia, secondMedia) => firstMedia.sortOrder - secondMedia.sortOrder)
          .map((media) => ({
            id: media.id,
            filename: media.filename,
            sortOrder: media.sortOrder,
            media
          }))

    try {
      setIsSaving(true)
      setError(null)
      const nextMediaFiles = await window.api?.collections.updateMedia(
        collectionId,
        baseMedia.map((media, index) => ({
          id: media.id,
          filename: renameById.get(media.id) ?? media.filename,
          sortOrder: isEditing ? index : media.sortOrder
        }))
      )
      const nextFiles = nextMediaFiles ?? []
      const nextMediaById = new Map(nextFiles.map((media) => [media.id, media]))
      setMediaFiles(nextFiles)
      setEditMedia(
        baseMedia.map((media, index) => {
          const filename = renameById.get(media.id) ?? media.filename
          const nextMedia = nextMediaById.get(media.id) ?? media.media
          return {
            id: media.id,
            filename,
            sortOrder: isEditing ? index : media.sortOrder,
            media: { ...nextMedia, filename }
          }
        })
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save smart rename changes.')
      throw reason
    } finally {
      setIsSaving(false)
    }
  }

  const saveSettings = async (): Promise<void> => {
    if (!collectionId) return

    try {
      setIsSaving(true)
      setError(null)
      await window.api?.collections.update({
        id: collectionId,
        name: editName,
        tagIds: editTagIds,
        coverImage: editThumbnail.coverImage,
        removeCover: editThumbnail.removeCover
      })
      if (isSingleFolder) {
        if (singleSource) {
          if (
            singleSource.isDynamic &&
            !singleSourceIsDynamicDraft &&
            shouldClearSinglePendingOnSave
          ) {
            await window.api?.collections.rejectSourcePendingMedia({
              sourceId: singleSource.id,
              mediaIds: singleSourcePendingMedia.map((media) => media.id)
            })
          }
          await window.api?.collections.updateSources(collectionId, [
            {
              id: singleSource.id,
              name: singleSource.name,
              sortOrder: singleSource.sortOrder,
              isDynamic: singleSourceIsDynamicDraft
            }
          ])
        }
        await window.api?.collections.updateMedia(
          collectionId,
          editMedia.map((media, index) => ({
            id: media.id,
            filename: media.filename,
            sortOrder: index
          }))
        )
      } else {
        const removedSourceIds =
          collection?.sources
            .filter((source) => !editSources.some((draft) => draft.id === source.id))
            .map((source) => source.id) ?? []
        for (const sourceId of removedSourceIds) {
          await window.api?.collections.deleteSource(sourceId)
        }
        await window.api?.collections.updateSources(
          collectionId,
          editSources.map((source, index) => ({
            id: source.id,
            name: source.name,
            sortOrder: index,
            isDynamic: source.source.isDynamic
          }))
        )
      }
      await reload()
      setIsEditing(false)
      setShouldClearSinglePendingOnSave(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save collection settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const addMediaToSingleSource = async (): Promise<void> => {
    if (!singleSource) return
    if (singleSource.isDynamic) {
      warning('Dynamic folders use rescan. Turn off Dynamic to add videos from other folders.')
      return
    }

    try {
      setError(null)
      const filePaths = await window.api?.collections.selectMediaFiles()
      if (!filePaths || filePaths.length === 0) return
      const nextMediaFiles = await window.api?.collections.addMedia({
        sourceId: singleSource.id,
        filePaths
      })
      setMediaFiles(nextMediaFiles ?? [])
      applyEditState(collection, nextMediaFiles ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add media.')
    }
  }

  const cancelSettings = async (): Promise<void> => {
    applyEditState(collection, mediaFiles)
    setShouldClearSinglePendingOnSave(false)
    setIsEditing(false)
  }

  const previewAddSource = async (sourcePath: string): Promise<AddSourceDraft> => {
    const preview = await window.api?.collections.previewSourceMedia(sourcePath)

    return {
      name: getFolderName(sourcePath),
      sourcePath,
      preview: preview ?? [],
      selectedFilePaths: (preview ?? []).map((media) => media.filePath),
      isDynamic: true,
      isPreviewOpen: false
    }
  }

  const chooseAddSourceFolder = async (): Promise<void> => {
    try {
      setError(null)
      const selectedPaths = await window.api?.collections.selectSourceFolders()
      if (!selectedPaths || selectedPaths.length === 0) return
      const existingPaths = new Set([
        ...(collection?.sources.map((source) => source.sourcePath) ?? []),
        ...addSourceDrafts.map((source) => source.sourcePath)
      ])
      const nextPaths = selectedPaths.filter((sourcePath) => !existingPaths.has(sourcePath))
      const nextDrafts = await Promise.all(
        nextPaths.map((sourcePath) => previewAddSource(sourcePath))
      )
      setAddSourceDrafts((current) => [...current, ...nextDrafts])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to select source folder.')
    }
  }

  const dropAddSourceFolder = async (event: DragEvent<HTMLButtonElement>): Promise<void> => {
    event.preventDefault()
    const fileWithPath = Array.from(event.dataTransfer.files)[0] as File & { path?: string }
    if (!fileWithPath?.path) {
      setError('Dropped folder path is not available. Use the folder picker instead.')
      return
    }

    if (
      addSourceDrafts.some((source) => source.sourcePath === fileWithPath.path) ||
      collection?.sources.some((source) => source.sourcePath === fileWithPath.path)
    ) {
      return
    }

    const draft = await previewAddSource(fileWithPath.path)
    setAddSourceDrafts((current) =>
      current.some((source) => source.sourcePath === draft.sourcePath)
        ? current
        : [...current, draft]
    )
  }

  const addSource = async (): Promise<void> => {
    if (!collectionId || addSourceDrafts.length === 0) return

    try {
      setIsSaving(true)
      setError(null)
      for (const sourceDraft of addSourceDrafts) {
        await window.api?.collections.addSource({
          collectionId,
          name: sourceDraft.name,
          sourcePath: sourceDraft.sourcePath,
          isDynamic: sourceDraft.isDynamic,
          includedFilePaths: sourceDraft.isDynamic ? undefined : sourceDraft.selectedFilePaths
        })
      }
      setIsAddSourceOpen(false)
      setAddSourceDrafts([])
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add source.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!collection && !error) return <p className="text-[#a9c8bf]">Loading collection...</p>

  return (
    <div className="flex w-full max-w-6xl flex-col gap-7">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate('/home')}
      >
        <ArrowLeft size={17} />
        Back to Home
      </button>

      {error && (
        <p className="rounded-lg border border-[#ff6f60]/25 bg-[#3e1c1f]/60 px-4 py-3 text-sm text-[#ffaaa0]">
          {error}
        </p>
      )}

      {collection && (
        <>
          <div className="flex items-end justify-between gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm font-semibold text-[#00d982]">COLLECTION</p>
              {isEditing ? (
                <input
                  className="w-full max-w-xl rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-2xl font-bold text-[#f4fff8] outline-none focus:border-[#00b875]"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={80}
                />
              ) : (
                <h1 className="truncate text-3xl font-bold">{collection.name}</h1>
              )}
              <p className="text-sm text-[#a9c8bf]">
                {collection.sources.length} {collection.sources.length === 1 ? 'folder' : 'folders'}{' '}
                - {playableMedia.length} {playableMedia.length === 1 ? 'video' : 'videos'}
              </p>
              {isEditing && singleSource ? (
                <label className="flex w-fit items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#a9c8bf]">
                  <input
                    className="mt-0.5 h-4 w-4 accent-[#00b875]"
                    type="checkbox"
                    checked={singleSourceIsDynamicDraft}
                    onChange={(event) => setSingleSourceDynamicDraft(event.target.checked)}
                  />
                  <span>
                    <span className="block font-bold text-[#f4fff8]">Dynamic source</span>
                    <span className="block text-xs">
                      Auto-follow this folder. Turn off to keep a manual list and add videos from
                      other folders.
                    </span>
                  </span>
                </label>
              ) : singleSource ? (
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                    singleSource.isDynamic
                      ? 'bg-[#00b875]/15 text-[#00d982]'
                      : 'bg-white/[0.08] text-[#d3e7e0]'
                  }`}
                >
                  {singleSource.isDynamic ? 'Dynamic folder' : 'Manual folder'}
                </span>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#a9c8bf]">
                  Rating
                </span>
                <div className="flex flex-wrap gap-1">
                  {Array.from({ length: 10 }, (_, index) => index + 1).map((rating) => (
                    <button
                      key={rating}
                      className={`grid h-7 w-7 place-items-center rounded text-xs font-black transition ${
                        collection.rating === rating
                          ? 'bg-[#00b875] text-[#04120d]'
                          : 'bg-white/[0.06] text-[#a9c8bf] hover:bg-white/[0.12] hover:text-[#f4fff8]'
                      }`}
                      type="button"
                      onClick={() => void updateCollectionRating(rating)}
                      aria-label={`Rate ${collection.name} ${rating}`}
                    >
                      {rating}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-[#a9c8bf]">
                  Tags
                </span>
                {isEditing ? (
                  availableTags.length > 0 ? (
                    availableTags.map((tag) => {
                      const isSelected = editTagIds.includes(tag.id)
                      return (
                        <button
                          key={tag.id}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                            isSelected
                              ? 'border-transparent text-[#04120d]'
                              : 'border-white/15 text-[#a9c8bf] hover:border-white/30 hover:text-[#f4fff8]'
                          }`}
                          style={isSelected ? { backgroundColor: tag.color } : undefined}
                          type="button"
                          onClick={() => toggleEditTag(tag.id)}
                        >
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          {formatTagName(tag.name)}
                        </button>
                      )
                    })
                  ) : (
                    <span className="text-sm text-[#a9c8bf]">No tags yet.</span>
                  )
                ) : collection.tags.length > 0 ? (
                  collection.tags.map((tag) => (
                    <span
                      key={tag.id}
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-bold text-[#04120d]"
                      style={{ backgroundColor: tag.color }}
                    >
                      <span className="h-2 w-2 rounded-full bg-black/35" />
                      {formatTagName(tag.name)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-[#a9c8bf]">No tags.</span>
                )}
              </div>
              {isEditing && (
                <div className="w-full max-w-xl pt-2">
                  <ThumbnailPicker
                    value={editThumbnail}
                    existingPreviewUrl={collection.coverPath}
                    videoOptions={thumbnailVideoOptions}
                    onChange={setEditThumbnail}
                    onPendingChange={setHasPendingThumbnail}
                  />
                  {hasPendingThumbnail && (
                    <p className="pt-2 text-sm text-[#ffcf8a]">
                      Approve the compressed thumbnail before confirming these settings.
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] hover:bg-white/5 disabled:opacity-60"
                    type="button"
                    onClick={() => void cancelSettings()}
                    disabled={isSaving}
                  >
                    <X size={18} />
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                    type="button"
                    onClick={() => void saveSettings()}
                    disabled={!editName.trim() || hasPendingThumbnail || isSaving}
                  >
                    <Check size={18} />
                    Confirm
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => setIsAddSourceOpen(true)}
                  >
                    <FilePlus size={18} />
                    Add Source
                  </button>
                  {isSingleFolder && singleSource && !singleSource.isDynamic && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5"
                      type="button"
                      onClick={() => void addMediaToSingleSource()}
                    >
                      <FilePlus size={18} />
                      Add Video
                    </button>
                  )}
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => setIsEditing(true)}
                  >
                    <Settings size={18} />
                    Settings
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
                    type="button"
                    onClick={playCollection}
                    disabled={playableMedia.length === 0}
                  >
                    <Play size={18} fill="currentColor" />
                    Play
                  </button>
                </>
              )}
            </div>
          </div>

          {isSingleFolder && singleSource && !isEditing && (
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'videos' as const, label: 'Videos', count: singleSourceApprovedMedia.length },
                ...(singleSource.isDynamic
                  ? [
                      {
                        id: 'pending' as const,
                        label: 'Pending',
                        count: singleSourcePendingMedia.length
                      }
                    ]
                  : []),
                ...(singleSource.isMissing || singleSourceMissingMedia.length > 0
                  ? [
                      {
                        id: 'missing' as const,
                        label: 'Missing files',
                        count: singleSourceMissingMedia.length
                      }
                    ]
                  : [])
              ].map((tab) => (
                <button
                  key={tab.id}
                  className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                    singleSourceActiveTab === tab.id
                      ? 'bg-[#00b875] text-[#04120d]'
                      : 'border border-white/15 text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                  }`}
                  type="button"
                  onClick={() => setSingleSourceActiveTab(tab.id)}
                >
                  {tab.label} {tab.count > 0 ? `(${tab.count})` : ''}
                </button>
              ))}
            </div>
          )}

          {isSingleFolder && (isEditing || singleSourceActiveTab === 'videos') && (
            <MediaFilesViewer
              title={isEditing ? 'Video settings' : 'Videos'}
              mediaFiles={singleSourceApprovedMedia}
              editMedia={editMedia}
              isEditing={isEditing}
              orderBy={singleSource?.mediaOrder ?? 'name'}
              onOrderChange={updateSingleSourceMediaOrder}
              onMove={moveMedia}
              onPlay={playMedia}
              onRenameDraft={renameMediaDraft}
              onRenameSave={saveMediaRename}
              onDeleteMedia={deleteMedia}
              onSmartRenameSave={saveSmartRename}
              emptyLabel={isEditing ? 'No videos.' : 'No videos found yet.'}
            />
          )}

          {isSingleFolder && singleSource && !isEditing && singleSourceActiveTab === 'pending' && (
            <section className="flex flex-col gap-4 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Pending</h2>
                  <p className="text-xs text-[#a9c8bf]">
                    New videos found by auto-scan. Approve them to move into Videos, or reject them
                    to remove the pending rows.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                    type="button"
                    onClick={() => void approveSingleSourcePendingMedia()}
                    disabled={singleSourcePendingMedia.length === 0 || isSaving}
                  >
                    Approve all
                  </button>
                  <button
                    className="rounded-lg border border-[#ff6f60]/35 px-3 py-2 text-sm font-bold text-[#ffaaa0] transition hover:bg-[#3e1c1f]/70 disabled:opacity-60"
                    type="button"
                    onClick={() => void rejectSingleSourcePendingMedia()}
                    disabled={singleSourcePendingMedia.length === 0 || isSaving}
                  >
                    Reject all
                  </button>
                </div>
              </div>
              <CollectionDataViewer
                items={singleSourcePendingMedia}
                getId={(media) => media.id}
                gridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                emptyState={
                  <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
                    No pending videos.
                  </div>
                }
                renderItem={(media, viewMode) => (
                  <VideoCard
                    media={media}
                    viewMode={viewMode}
                    onPlay={() => setError('Approve this pending video before playback.')}
                    onDelete={() => void rejectSingleSourcePendingMedia([media.id])}
                  />
                )}
              />
            </section>
          )}

          {isSingleFolder && singleSource && !isEditing && singleSourceActiveTab === 'missing' && (
            <section className="flex flex-col gap-4 pt-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold">Missing files</h2>
                  <p className="text-xs text-[#a9c8bf]">
                    These approved rows no longer point to files on this computer.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-[#ff6f60] px-4 py-2.5 text-sm font-bold text-[#220806] disabled:opacity-60"
                  type="button"
                  onClick={() =>
                    void deleteMedia(singleSourceMissingMedia.map((media) => media.id))
                  }
                  disabled={singleSourceMissingMedia.length === 0 || isSaving}
                >
                  Delete all
                </button>
              </div>
              <CollectionDataViewer
                items={singleSourceMissingMedia}
                getId={(media) => media.id}
                gridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                emptyState={
                  <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
                    No missing files.
                  </div>
                }
                renderItem={(media, viewMode) => (
                  <VideoCard
                    media={media}
                    viewMode={viewMode}
                    onPlay={playMedia}
                    onDelete={() => void deleteMedia([media.id])}
                  />
                )}
              />
            </section>
          )}

          {isEditing && !isSingleFolder && (
            <section className="flex flex-col gap-4 pt-3">
              <h2 className="text-lg font-bold">Collection settings</h2>
              <CollectionDataViewer
                items={editSources}
                getId={(source) => source.id}
                isEditing
                onMove={moveSource}
                emptyState={
                  <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
                    No sources.
                  </div>
                }
                renderItem={(source, viewMode) => {
                  const videoCount = mediaCountBySource[source.id] ?? 0
                  const isGridPreview = viewMode === 'grid'

                  return (
                    <article
                      className={`flex min-w-0 gap-3 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 transition hover:border-[#00b875]/45 hover:bg-[#00b875]/[0.045] ${
                        isGridPreview ? 'flex-col' : 'items-center'
                      }`}
                    >
                      <div
                        className={`grid shrink-0 place-items-center rounded-lg bg-[#00b875]/10 text-[#00d982] ${
                          isGridPreview ? 'h-16 w-full' : 'h-16 w-24'
                        }`}
                      >
                        <FolderOpen size={isGridPreview ? 28 : 22} />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col gap-2">
                        <input
                          className="w-full rounded-lg border border-white/15 bg-[#0d0f12] px-3 py-2 text-sm font-bold text-[#f4fff8] outline-none placeholder:text-white/35 focus:border-[#00b875]"
                          value={source.name}
                          onChange={(event) =>
                            setEditSources((current) =>
                              current.map((item) =>
                                item.id === source.id ? { ...item, name: event.target.value } : item
                              )
                            )
                          }
                        />
                        <p className="truncate text-xs text-[#a9c8bf]">
                          {source.source.sourcePath}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[11px] font-bold text-[#a9c8bf]">
                            {videoCount} {videoCount === 1 ? 'video' : 'videos'}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              source.source.isDynamic
                                ? 'bg-[#00b875]/15 text-[#00d982]'
                                : 'bg-white/[0.08] text-[#d3e7e0]'
                            }`}
                          >
                            {source.source.isDynamic ? 'Dynamic' : 'Manual'}
                          </span>
                          {source.source.isMissing && (
                            <span className="rounded-full bg-[#ff6f60]/15 px-2.5 py-1 text-[11px] font-bold text-[#ffaaa0]">
                              Missing
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-[#ffaaa0] transition hover:bg-[#3e1c1f]/70"
                        type="button"
                        onClick={() => removeSourceDraft(source.id)}
                        aria-label={`Delete ${source.name}`}
                      >
                        <Trash2 size={18} />
                      </button>
                    </article>
                  )
                }}
              />
            </section>
          )}

          {!isEditing && !isSingleFolder && (
            <section className="flex flex-col gap-4 pt-3">
              <h2 className="text-lg font-bold">Folders</h2>
              <CollectionDataViewer
                items={collection.sources}
                getId={(source) => source.id}
                emptyState={
                  <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
                    <div className="flex flex-col items-center gap-3">
                      <FolderOpen />
                      <span>No sources added yet.</span>
                    </div>
                  </div>
                }
                renderItem={(source, viewMode) => (
                  <SourceCard
                    source={source}
                    viewMode={viewMode}
                    collectionId={collection.id}
                    videoCount={mediaCountBySource[source.id] ?? 0}
                    onRename={(selectedSource) =>
                      navigate(
                        `/home/collections/${collection.id}/sources/${selectedSource.id}?edit=1`
                      )
                    }
                  />
                )}
              />
            </section>
          )}
        </>
      )}

      {isAddSourceOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold">Add source</h2>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={() => setIsAddSourceOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <button
              className="rounded-xl border border-dashed border-white/20 bg-[#0d0f12]/70 px-4 py-8 text-left hover:border-[#00b875]/70"
              type="button"
              onClick={() => void chooseAddSourceFolder()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void dropAddSourceFolder(event)}
            >
              <span className="flex items-center gap-3">
                <FolderOpen className="text-[#00d982]" size={22} />
                <span className="min-w-0">
                  <span className="block font-semibold">Click or drag folders here</span>
                  <span className="block text-sm text-[#a9c8bf]">
                    {addSourceDrafts.length > 0
                      ? `${addSourceDrafts.length} folder${addSourceDrafts.length === 1 ? '' : 's'} ready`
                      : 'Each selected folder becomes its own source.'}
                  </span>
                </span>
              </span>
            </button>

            <div className="flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
              {addSourceDrafts.map((sourceDraft) => (
                <section
                  key={sourceDraft.sourcePath}
                  className="rounded-xl border border-white/10 bg-[#0d0f12]/70"
                >
                  <div className="flex items-center gap-3 p-3">
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5"
                      type="button"
                      onClick={() =>
                        setAddSourceDrafts((current) =>
                          current.map((item) =>
                            item.sourcePath === sourceDraft.sourcePath
                              ? { ...item, isPreviewOpen: !item.isPreviewOpen }
                              : item
                          )
                        )
                      }
                      aria-label={`Toggle preview for ${sourceDraft.sourcePath}`}
                    >
                      <ChevronDown
                        className={`transition-transform ${
                          sourceDraft.isPreviewOpen ? 'rotate-0' : '-rotate-90'
                        }`}
                        size={18}
                      />
                    </button>
                    <FolderOpen className="shrink-0 text-[#00d982]" size={19} />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <input
                        className="w-full rounded-lg border border-white/15 bg-[#171a1f] px-3 py-2 text-sm font-bold text-[#f4fff8] outline-none placeholder:text-white/35 focus:border-[#00b875]"
                        value={sourceDraft.name}
                        placeholder="Source name"
                        maxLength={80}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) =>
                          setAddSourceDrafts((current) =>
                            current.map((item) =>
                              item.sourcePath === sourceDraft.sourcePath
                                ? { ...item, name: event.target.value }
                                : item
                            )
                          )
                        }
                      />
                      <p className="truncate text-xs text-[#a9c8bf]">{sourceDraft.sourcePath}</p>
                      <p className="text-xs text-[#a9c8bf]">
                        {sourceDraft.preview.length} videos found -{' '}
                        {sourceDraft.isDynamic
                          ? 'dynamic'
                          : `${sourceDraft.selectedFilePaths.length} selected`}
                      </p>
                    </div>
                    <label
                      className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-[#a9c8bf]"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Dynamic
                      <input
                        className="h-4 w-4 accent-[#00b875]"
                        type="checkbox"
                        checked={sourceDraft.isDynamic}
                        onChange={(event) =>
                          setAddSourceDrafts((current) =>
                            current.map((item) =>
                              item.sourcePath === sourceDraft.sourcePath
                                ? { ...item, isDynamic: event.target.checked }
                                : item
                            )
                          )
                        }
                      />
                    </label>
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-[#ffaaa0] hover:bg-[#3e1c1f]/70"
                      type="button"
                      onClick={() =>
                        setAddSourceDrafts((current) =>
                          current.filter((item) => item.sourcePath !== sourceDraft.sourcePath)
                        )
                      }
                      aria-label={`Remove ${sourceDraft.sourcePath}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                  {sourceDraft.isPreviewOpen && (
                    <div className="max-h-56 overflow-y-auto border-t border-white/10">
                      {sourceDraft.preview.map((media) => (
                        <label
                          key={media.filePath}
                          className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
                        >
                          <input
                            className="h-4 w-4 accent-[#00b875] disabled:opacity-35"
                            type="checkbox"
                            disabled={sourceDraft.isDynamic}
                            checked={
                              sourceDraft.isDynamic ||
                              sourceDraft.selectedFilePaths.includes(media.filePath)
                            }
                            onChange={(event) => {
                              setAddSourceDrafts((current) =>
                                current.map((item) => {
                                  if (item.sourcePath !== sourceDraft.sourcePath) return item
                                  const selectedFilePaths = event.target.checked
                                    ? [...new Set([...item.selectedFilePaths, media.filePath])]
                                    : item.selectedFilePaths.filter(
                                        (path) => path !== media.filePath
                                      )
                                  return { ...item, selectedFilePaths }
                                })
                              )
                            }}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {media.filename}
                            </span>
                            <span className="block truncate text-xs text-[#a9c8bf]">
                              {media.filePath}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {addSourceDrafts.length === 0 && (
                <div className="rounded-lg border border-dashed border-white/15 p-5 text-center text-sm text-[#a9c8bf]">
                  No folders selected yet.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => {
                  setIsAddSourceOpen(false)
                  setAddSourceDrafts([])
                }}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                type="button"
                onClick={() => void addSource()}
                disabled={
                  addSourceDrafts.length === 0 ||
                  addSourceDrafts.some((source) => !source.name.trim()) ||
                  isSaving
                }
              >
                Add {addSourceDrafts.length > 1 ? `${addSourceDrafts.length} Sources` : 'Source'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSingleMissingAlertOpen &&
        singleSource &&
        (singleSource.isMissing || singleSourceMissingMedia.length > 0) && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
            <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
              <div>
                <h2 className="text-lg font-bold">
                  {singleSource.isMissing ? 'Source folder is missing' : 'File is missing'}
                </h2>
                <p className="pt-2 text-sm text-[#a9c8bf]">
                  {singleSource.isMissing
                    ? `The source folder path is unavailable. NexMP moved you to Missing files so you can review stored items from ${singleSource.sourcePath}.`
                    : `${singleSourceMissingMedia.length} ${
                        singleSourceMissingMedia.length === 1 ? 'file is' : 'files are'
                      } missing and moved to the Missing files tab.`}
                </p>
              </div>
              <div className="flex justify-end">
                <button
                  className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d]"
                  type="button"
                  onClick={() => setIsSingleMissingAlertOpen(false)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

      {isSingleDynamicOffConfirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div>
              <h2 className="text-lg font-bold">Turn off Dynamic?</h2>
              <p className="pt-2 text-sm text-[#a9c8bf]">
                This folder has {singleSourcePendingMedia.length} pending{' '}
                {singleSourcePendingMedia.length === 1 ? 'video' : 'videos'}. Turning off Dynamic
                will delete those pending rows when you confirm settings.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setIsSingleDynamicOffConfirmOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#220806]"
                type="button"
                onClick={confirmSingleSourceDynamicOff}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
