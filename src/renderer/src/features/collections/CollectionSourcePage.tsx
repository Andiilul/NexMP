import { ArrowLeft, Check, FilePlus, Pencil, Play, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  CollectionSource,
  CollectionWithSources,
  MediaFile,
  SourceMediaOrder
} from '../../../../shared/types/collection'
import { useToast } from '../../components/useToast'
import { createPlayablePlaylist, type PlayerRouteState } from './mediaPlayback'
import {
  MediaFilesViewer,
  type MediaEditDraft,
  type SmartRenameSaveInput
} from './MediaFilesViewer'
import { CollectionDataViewer } from './CollectionDataViewer'
import { VideoCard } from './VideoCard'

type SourceMediaTab = 'videos' | 'pending' | 'missing'
type ChangePathPreview = {
  sourcePath: string
  previewCount: number
}

export function CollectionSourcePage(): React.JSX.Element {
  const { collectionId, sourceId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const toast = useToast()
  const [collection, setCollection] = useState<CollectionWithSources | null>(null)
  const [source, setSource] = useState<CollectionSource | null>(null)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [editSourceName, setEditSourceName] = useState('')
  const [editSourceIsDynamic, setEditSourceIsDynamic] = useState(true)
  const [editMedia, setEditMedia] = useState<MediaEditDraft[]>([])
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<SourceMediaTab>('videos')
  const [selectedPendingMediaIds, setSelectedPendingMediaIds] = useState<string[]>([])
  const [isMissingAlertOpen, setIsMissingAlertOpen] = useState(false)
  const [isDynamicOffConfirmOpen, setIsDynamicOffConfirmOpen] = useState(false)
  const [newPendingNoticeCount, setNewPendingNoticeCount] = useState(0)
  const [dynamicOffPendingAction, setDynamicOffPendingAction] = useState<
    'ignore' | 'approve' | null
  >(null)
  const [changePathPreview, setChangePathPreview] = useState<ChangePathPreview | null>(null)
  const hasShownMissingAlertRef = useRef(false)
  const returnTo = `${location.pathname}${location.search}`

  const approvedMedia = mediaFiles.filter((media) => !media.isMissing && !media.isPending)
  const pendingMedia = source?.isDynamic
    ? mediaFiles.filter((media) => media.isPending && !media.isMissing)
    : []
  const missingMedia = mediaFiles.filter((media) => media.isMissing && !media.isPending)
  const playableMedia = approvedMedia

  const applyEditState = (
    nextSource: CollectionSource | null,
    nextMediaFiles: MediaFile[]
  ): void => {
    if (!nextSource) return
    setEditSourceName(nextSource.name)
    setEditSourceIsDynamic(nextSource.isDynamic)
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

  const fetchSource = useCallback(
    async (
      scanDynamic = false
    ): Promise<{
      nextCollection: CollectionWithSources | null
      nextSource: CollectionSource | null
      nextMediaFiles: MediaFile[]
      newPendingMedia: MediaFile[]
    }> => {
      const profileId = sessionStorage.getItem('nexmp.active-profile-id')
      if (!profileId || !collectionId || !sourceId) {
        navigate('/home')
        return { nextCollection: null, nextSource: null, nextMediaFiles: [], newPendingMedia: [] }
      }

      const collectionApi = window.api?.collections
      if (!collectionApi)
        throw new Error('Collection service is unavailable. Please restart NexMP.')

      const availabilityMediaFiles = await collectionApi.refreshSourceMediaAvailability(sourceId)
      const refreshedItems = await collectionApi.list(profileId)
      const refreshedCollection = refreshedItems.find((item) => item.id === collectionId) ?? null
      const refreshedSource =
        refreshedCollection?.sources.find((item) => item.id === sourceId) ?? null
      const knownPaths = new Set(
        availabilityMediaFiles
          .filter((media) => media.collectionSourceId === sourceId)
          .map((media) => media.filePath)
      )
      const nextMediaFiles =
        scanDynamic && refreshedSource?.isDynamic
          ? await collectionApi.rescanSource(sourceId)
          : availabilityMediaFiles
      const items =
        scanDynamic && refreshedSource?.isDynamic
          ? await collectionApi.list(profileId)
          : refreshedItems
      const nextCollection = items.find((item) => item.id === collectionId) ?? null
      const nextSource = nextCollection?.sources.find((item) => item.id === sourceId) ?? null
      const nextSourceMediaFiles = nextMediaFiles.filter(
        (media) => media.collectionSourceId === sourceId
      )
      const newPendingMedia = nextSourceMediaFiles.filter(
        (media) => media.isPending && !media.isMissing && !knownPaths.has(media.filePath)
      )

      return {
        nextCollection,
        nextSource,
        nextMediaFiles: nextSourceMediaFiles,
        newPendingMedia
      }
    },
    [collectionId, navigate, sourceId]
  )

  const reload = useCallback(async (): Promise<void> => {
    const { nextCollection, nextSource, nextMediaFiles } = await fetchSource()
    setCollection(nextCollection)
    setSource(nextSource)
    setMediaFiles(nextMediaFiles)
    applyEditState(nextSource, nextMediaFiles)
  }, [fetchSource])

  const reviewPendingMedia = useCallback((): void => {
    setActiveTab('pending')
    setNewPendingNoticeCount(0)
  }, [])

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        const { nextCollection, nextSource, nextMediaFiles, newPendingMedia } =
          await fetchSource(true)
        if (!isMounted) return
        setCollection(nextCollection)
        setSource(nextSource)
        setMediaFiles(nextMediaFiles)
        applyEditState(nextSource, nextMediaFiles)
        const nextMissingMedia = nextMediaFiles.filter(
          (media) => media.collectionSourceId === sourceId && media.isMissing && !media.isPending
        )
        if (newPendingMedia.length > 0) {
          const label = `${newPendingMedia.length} new ${
            newPendingMedia.length === 1 ? 'video' : 'videos'
          }`
          setNewPendingNoticeCount(newPendingMedia.length)
          toast.showToast({
            mode: 'info',
            title: `Found ${label} in this source.`,
            description: 'Review pending items before they move into Videos.',
            action: {
              label: 'Review',
              onClick: reviewPendingMedia
            }
          })
          setActiveTab('pending')
        } else if (
          !hasShownMissingAlertRef.current &&
          (nextSource?.isMissing || nextMissingMedia.length > 0)
        ) {
          hasShownMissingAlertRef.current = true
          setActiveTab('missing')
          setIsMissingAlertOpen(true)
        }
      } catch (reason) {
        if (!isMounted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load this source.')
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [fetchSource, reviewPendingMedia, sourceId, toast])

  const playMedia = (media: MediaFile): void => {
    if (media.isMissing) {
      setError(`File not available: ${media.filePath}`)
      return
    }
    if (media.isPending) {
      setError('Approve this pending video before playback.')
      return
    }

    const playlist = createPlayablePlaylist(approvedMedia)
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

  const playSource = (): void => {
    const playlist = createPlayablePlaylist(approvedMedia)
    if (playlist.length === 0) {
      toast.warning('This source does not have playable videos yet.')
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

  const saveEdit = async (): Promise<void> => {
    if (!collectionId || !source) return

    try {
      setIsSaving(true)
      setError(null)
      await window.api?.collections.updateSources(collectionId, [
        {
          id: source.id,
          name: editSourceName,
          sortOrder: source.sortOrder,
          isDynamic: editSourceIsDynamic,
          pendingAction:
            source.isDynamic && !editSourceIsDynamic
              ? (dynamicOffPendingAction ?? 'ignore')
              : undefined
        }
      ])
      await window.api?.collections.updateMedia(
        collectionId,
        editMedia.map((media, index) => ({
          id: media.id,
          filename: media.filename,
          sortOrder: index
        }))
      )
      await reload()
      setIsEditing(false)
      setDynamicOffPendingAction(null)
      if (source.isDynamic && !editSourceIsDynamic) setActiveTab('videos')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save source changes.')
    } finally {
      setIsSaving(false)
    }
  }

  const addMedia = async (): Promise<void> => {
    if (!sourceId) return
    if (source?.isDynamic) {
      toast.warning(
        'Dynamic folders use rescan. Turn off Dynamic to add videos from other folders.'
      )
      return
    }

    try {
      setError(null)
      const filePaths = await window.api?.collections.selectMediaFiles()
      if (!filePaths || filePaths.length === 0) return
      const nextMediaFiles = await window.api?.collections.addMedia({ sourceId, filePaths })
      setMediaFiles((nextMediaFiles ?? []).filter((media) => media.collectionSourceId === sourceId))
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add media.')
    }
  }

  const createChangePathPreview = async (sourcePath: string): Promise<ChangePathPreview> => {
    const preview = await window.api?.collections.previewSourceMedia(sourcePath)

    return {
      sourcePath,
      previewCount: preview?.length ?? 0
    }
  }

  const requestDynamicChange = (isDynamic: boolean): void => {
    if (source?.isDynamic && !isDynamic) {
      setIsDynamicOffConfirmOpen(true)
      return
    }

    if (source && !source.isDynamic && isDynamic) {
      toast.warning(
        'Manual sources cannot be changed back to Dynamic. Create a new dynamic source.'
      )
      return
    }

    setEditSourceIsDynamic(isDynamic)
    if (isDynamic) setDynamicOffPendingAction(null)
  }

  const confirmDynamicOff = (pendingAction: 'ignore' | 'approve'): void => {
    setEditSourceIsDynamic(false)
    setDynamicOffPendingAction(pendingAction)
    setIsDynamicOffConfirmOpen(false)
  }

  const chooseDynamicPath = async (): Promise<void> => {
    if (!source?.isDynamic) return

    try {
      setError(null)
      const selectedPaths = await window.api?.collections.selectSourceFolders()
      const selectedPath = selectedPaths?.[0]
      if (!selectedPath) return

      setChangePathPreview(await createChangePathPreview(selectedPath))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to preview source folder.')
    }
  }

  const confirmDynamicPathChange = async (): Promise<void> => {
    if (!sourceId || !changePathPreview) return

    try {
      setIsSaving(true)
      setError(null)
      const nextMediaFiles = await window.api?.collections.changeSourcePath({
        sourceId,
        sourcePath: changePathPreview.sourcePath
      })
      const nextSourceMedia = (nextMediaFiles ?? []).filter(
        (media) => media.collectionSourceId === sourceId
      )
      setMediaFiles(nextSourceMedia)
      setChangePathPreview(null)
      await reload()
      if (nextSourceMedia.some((media) => media.isPending && !media.isMissing)) {
        setActiveTab('pending')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to change source path.')
    } finally {
      setIsSaving(false)
    }
  }

  const showSourceInExplorer = async (): Promise<void> => {
    if (!source) return

    try {
      await window.api?.collections.showSourceInExplorer(source.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to show source in Explorer.')
    }
  }

  const toggleSelectedPendingMedia = (media: MediaFile, isSelected: boolean): void => {
    setSelectedPendingMediaIds((currentIds) =>
      isSelected
        ? [...new Set([...currentIds, media.id])]
        : currentIds.filter((mediaId) => mediaId !== media.id)
    )
  }

  const approvePendingMedia = async (mediaIds?: string[]): Promise<void> => {
    if (!sourceId) return

    try {
      setIsSaving(true)
      setError(null)
      const nextMediaFiles = await window.api?.collections.approveSourcePendingMedia({
        sourceId,
        mediaIds
      })
      const nextSourceMedia = (nextMediaFiles ?? []).filter(
        (media) => media.collectionSourceId === sourceId
      )
      const nextPendingMedia = nextSourceMedia.filter(
        (media) => media.isPending && !media.isMissing
      )
      setMediaFiles(nextSourceMedia)
      applyEditState(source, nextSourceMedia)
      setSelectedPendingMediaIds((currentIds) =>
        currentIds.filter((mediaId) => nextPendingMedia.some((media) => media.id === mediaId))
      )
      if (nextPendingMedia.length === 0) setActiveTab('videos')
      toast.success('Pending videos approved.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to approve pending videos.')
    } finally {
      setIsSaving(false)
    }
  }

  const rejectPendingMedia = async (mediaIds?: string[]): Promise<void> => {
    if (!sourceId) return

    try {
      setIsSaving(true)
      setError(null)
      const nextMediaFiles = await window.api?.collections.rejectSourcePendingMedia({
        sourceId,
        mediaIds
      })
      const nextSourceMedia = (nextMediaFiles ?? []).filter(
        (media) => media.collectionSourceId === sourceId
      )
      const nextPendingMedia = nextSourceMedia.filter(
        (media) => media.isPending && !media.isMissing
      )
      setMediaFiles(nextSourceMedia)
      applyEditState(source, nextSourceMedia)
      setSelectedPendingMediaIds((currentIds) =>
        currentIds.filter((mediaId) => nextPendingMedia.some((media) => media.id === mediaId))
      )
      if (nextPendingMedia.length === 0) setActiveTab('videos')
      toast.info('Pending videos rejected.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to reject pending videos.')
    } finally {
      setIsSaving(false)
    }
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

    const baseMedia = [...approvedMedia].sort((firstMedia, secondMedia) => {
      return firstMedia.sortOrder - secondMedia.sortOrder
    })
    const nextCollectionMedia = await window.api?.collections.updateMedia(
      collectionId,
      baseMedia.map((media) => ({
        id: media.id,
        filename: media.id === mediaId ? filename : media.filename,
        sortOrder: media.sortOrder
      }))
    )
    const nextSourceMedia = (nextCollectionMedia ?? []).filter(
      (media) => media.collectionSourceId === sourceId
    )
    setMediaFiles(nextSourceMedia)
    applyEditState(source, nextSourceMedia)
  }

  const deleteMedia = async (mediaIds: string[]): Promise<void> => {
    if (!collectionId) return

    const nextCollectionMedia = await window.api?.collections.deleteMedia(collectionId, mediaIds)
    const nextSourceMedia = (nextCollectionMedia ?? []).filter(
      (media) => media.collectionSourceId === sourceId
    )
    setMediaFiles(nextSourceMedia)
    applyEditState(source, nextSourceMedia)
  }

  const updateSourceMediaOrder = async (mediaOrder: SourceMediaOrder): Promise<void> => {
    if (!sourceId) return

    try {
      setError(null)
      const nextCollection = await window.api?.collections.updateSourceMediaOrder({
        sourceId,
        mediaOrder
      })
      const nextSource =
        nextCollection?.sources.find((item) => item.id === sourceId) ??
        (source ? { ...source, mediaOrder } : null)
      const nextMediaFiles = await window.api?.collections.listSourceMedia(sourceId)

      setCollection(nextCollection ?? collection)
      setSource(nextSource)
      setMediaFiles(nextMediaFiles ?? [])
      applyEditState(nextSource, nextMediaFiles ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update media order.')
    }
  }

  const saveSmartRename = async (renames: SmartRenameSaveInput[]): Promise<void> => {
    if (!collectionId) return

    const renameById = new Map(renames.map((rename) => [rename.id, rename.filename]))
    const baseMedia = isEditing
      ? editMedia
      : [...approvedMedia]
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
      const nextCollectionMedia = await window.api?.collections.updateMedia(
        collectionId,
        baseMedia.map((media, index) => ({
          id: media.id,
          filename: renameById.get(media.id) ?? media.filename,
          sortOrder: isEditing ? index : media.sortOrder
        }))
      )
      const nextSourceMedia = (nextCollectionMedia ?? []).filter(
        (media) => media.collectionSourceId === sourceId
      )
      const nextMediaById = new Map(nextSourceMedia.map((media) => [media.id, media]))
      setMediaFiles(nextSourceMedia)
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

  if (!source && !error) return <p className="text-[#a9c8bf]">Loading source...</p>

  return (
    <div className="flex w-full max-w-6xl flex-col gap-7">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate(`/home/collections/${collectionId}`)}
      >
        <ArrowLeft size={17} />
        Back to Collection
      </button>

      {error && (
        <p className="rounded-lg border border-[#ff6f60]/25 bg-[#3e1c1f]/60 px-4 py-3 text-sm text-[#ffaaa0]">
          {error}
        </p>
      )}

      {source && (
        <>
          <div className="flex items-end justify-between gap-5">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-sm font-semibold text-[#00d982]">SOURCE</p>
              {isEditing ? (
                <input
                  className="w-full max-w-xl rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-2xl font-bold text-[#f4fff8] outline-none focus:border-[#00b875]"
                  value={editSourceName}
                  onChange={(event) => setEditSourceName(event.target.value)}
                  autoFocus
                />
              ) : (
                <h1 className="truncate text-3xl font-bold">{source.name}</h1>
              )}
              <p className="truncate text-sm text-[#a9c8bf]">
                {playableMedia.length} {playableMedia.length === 1 ? 'video' : 'videos'}
              </p>
              {isEditing ? (
                <label className="flex w-fit items-start gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-[#a9c8bf]">
                  <input
                    className="mt-0.5 h-4 w-4 accent-[#00b875] disabled:opacity-40"
                    type="checkbox"
                    checked={editSourceIsDynamic}
                    onChange={(event) => requestDynamicChange(event.target.checked)}
                    disabled={!source.isDynamic}
                  />
                  <span>
                    <span className="block font-bold text-[#f4fff8]">Dynamic source</span>
                    <span className="block text-xs">
                      {source.isDynamic
                        ? 'Auto-follow this folder. Turn off to keep a manual list and add videos from other folders. This cannot be changed back to Dynamic.'
                        : 'Manual sources cannot be changed back to Dynamic. Create a new dynamic source instead.'}
                    </span>
                  </span>
                </label>
              ) : (
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-bold ${
                    source.isDynamic
                      ? 'bg-[#00b875]/15 text-[#00d982]'
                      : 'bg-white/[0.08] text-[#d3e7e0]'
                  }`}
                >
                  {source.isDynamic ? 'Dynamic folder' : 'Manual folder'}
                </span>
              )}
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {isEditing ? (
                <>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] hover:bg-white/5 disabled:opacity-60"
                    type="button"
                    onClick={() => {
                      void reload()
                      setIsEditing(false)
                    }}
                    disabled={isSaving}
                  >
                    <X size={18} />
                    Cancel
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                    type="button"
                    onClick={() => void saveEdit()}
                    disabled={!editSourceName.trim() || isSaving}
                  >
                    <Check size={18} />
                    Confirm
                  </button>
                </>
              ) : (
                <>
                  {!source.isDynamic && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5"
                      type="button"
                      onClick={() => void addMedia()}
                    >
                      <FilePlus size={18} />
                      Add Media
                    </button>
                  )}
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil size={18} />
                    Edit
                  </button>
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
                    type="button"
                    onClick={playSource}
                    disabled={playableMedia.length === 0}
                  >
                    <Play size={18} fill="currentColor" />
                    Play
                  </button>
                </>
              )}
            </div>
          </div>

          {!isEditing && source.isDynamic && (
            <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-[#00d982]">
                    Dynamic folder path
                  </p>
                  <p className="truncate pt-1 text-sm text-[#d3e7e0]">{source.sourcePath}</p>
                  <p className="pt-1 text-xs text-[#a9c8bf]">
                    This folder auto-rescans when opened. Add Media is disabled for dynamic folders.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => void showSourceInExplorer()}
                  >
                    Show in Explorer
                  </button>
                  <button
                    className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => void chooseDynamicPath()}
                  >
                    Change Path
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-4 pt-4">
            {!isEditing && newPendingNoticeCount > 0 && pendingMedia.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#f5b84b]/35 bg-[#2b2110]/70 px-4 py-3 text-sm text-[#f4fff8]">
                <div>
                  <p className="font-bold">
                    {newPendingNoticeCount} new {newPendingNoticeCount === 1 ? 'video' : 'videos'}{' '}
                    found from dynamic scan
                  </p>
                  <p className="text-xs text-[#f5dca1]">
                    Review pending items before adding them to Videos.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    className="rounded-lg bg-[#f5b84b] px-3 py-2 text-xs font-bold text-[#1d1506] transition hover:bg-[#f5c76d]"
                    type="button"
                    onClick={reviewPendingMedia}
                  >
                    Review
                  </button>
                  <button
                    className="rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => setNewPendingNoticeCount(0)}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
            {!isEditing && (
              <div className="flex flex-wrap items-center gap-2">
                {[
                  { id: 'videos' as const, label: 'Videos', count: approvedMedia.length },
                  ...(source.isDynamic
                    ? [{ id: 'pending' as const, label: 'Pending', count: pendingMedia.length }]
                    : []),
                  ...(source.isMissing || missingMedia.length > 0
                    ? [
                        {
                          id: 'missing' as const,
                          label: 'Missing files',
                          count: missingMedia.length
                        }
                      ]
                    : [])
                ].map((tab) => (
                  <button
                    key={tab.id}
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                      activeTab === tab.id
                        ? 'bg-[#00b875] text-[#04120d]'
                        : 'border border-white/15 text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                    }`}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span
                        className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                          tab.id === 'pending'
                            ? activeTab === tab.id
                              ? 'bg-[#04120d]/15 text-[#04120d]'
                              : 'bg-[#f5b84b]/20 text-[#f5c76d]'
                            : activeTab === tab.id
                              ? 'bg-[#04120d]/15 text-[#04120d]'
                              : 'bg-white/10 text-[#d3e7e0]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {(isEditing || activeTab === 'videos') && (
              <MediaFilesViewer
                title="Videos"
                mediaFiles={approvedMedia}
                editMedia={editMedia}
                isEditing={isEditing}
                orderBy={source.mediaOrder}
                onOrderChange={updateSourceMediaOrder}
                onMove={moveMedia}
                onPlay={playMedia}
                onRenameDraft={renameMediaDraft}
                onRenameSave={saveMediaRename}
                onDeleteMedia={deleteMedia}
                onSmartRenameSave={saveSmartRename}
              />
            )}

            {!isEditing && activeTab === 'pending' && source.isDynamic && (
              <section className="flex flex-col gap-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">Pending</h2>
                    <p className="text-xs text-[#a9c8bf]">
                      New videos found by rescan. Approve them to move into Videos, or reject them
                      to remove the pending rows.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                      type="button"
                      onClick={() =>
                        setSelectedPendingMediaIds(pendingMedia.map((media) => media.id))
                      }
                      disabled={
                        pendingMedia.length === 0 ||
                        selectedPendingMediaIds.length === pendingMedia.length
                      }
                    >
                      Select all
                    </button>
                    <button
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                      type="button"
                      onClick={() => setSelectedPendingMediaIds([])}
                      disabled={selectedPendingMediaIds.length === 0}
                    >
                      Clear
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-3 py-2 text-sm font-bold text-[#04120d] disabled:opacity-60"
                      type="button"
                      onClick={() => void approvePendingMedia(selectedPendingMediaIds)}
                      disabled={selectedPendingMediaIds.length === 0 || isSaving}
                    >
                      <Check size={16} />
                      Approve selected
                    </button>
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-[#ff6f60]/35 px-3 py-2 text-sm font-bold text-[#ffaaa0] transition hover:bg-[#3e1c1f]/70 disabled:opacity-60"
                      type="button"
                      onClick={() => void rejectPendingMedia(selectedPendingMediaIds)}
                      disabled={selectedPendingMediaIds.length === 0 || isSaving}
                    >
                      <X size={16} />
                      Reject selected
                    </button>
                    <button
                      className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                      type="button"
                      onClick={() => void approvePendingMedia()}
                      disabled={pendingMedia.length === 0 || isSaving}
                    >
                      Approve all
                    </button>
                    <button
                      className="rounded-lg border border-[#ff6f60]/35 px-3 py-2 text-sm font-bold text-[#ffaaa0] transition hover:bg-[#3e1c1f]/70 disabled:opacity-60"
                      type="button"
                      onClick={() => void rejectPendingMedia()}
                      disabled={pendingMedia.length === 0 || isSaving}
                    >
                      Reject all
                    </button>
                  </div>
                </div>
                <CollectionDataViewer
                  items={pendingMedia}
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
                      onDelete={() => void rejectPendingMedia([media.id])}
                      isSelectable
                      isSelected={selectedPendingMediaIds.includes(media.id)}
                      onSelectChange={toggleSelectedPendingMedia}
                    />
                  )}
                />
              </section>
            )}

            {!isEditing && activeTab === 'missing' && (
              <section className="flex flex-col gap-4 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold">Missing files</h2>
                    <p className="text-xs text-[#a9c8bf]">
                      These approved/manual rows no longer point to files on this computer.
                    </p>
                  </div>
                  <button
                    className="rounded-lg bg-[#ff6f60] px-4 py-2.5 text-sm font-bold text-[#220806] disabled:opacity-60"
                    type="button"
                    onClick={() => void deleteMedia(missingMedia.map((media) => media.id))}
                    disabled={missingMedia.length === 0 || isSaving}
                  >
                    Delete all
                  </button>
                </div>
                <CollectionDataViewer
                  items={missingMedia}
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
          </section>
        </>
      )}

      {isMissingAlertOpen && (source?.isMissing || missingMedia.length > 0) && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div>
              <h2 className="text-lg font-bold">
                {source?.isMissing ? 'Source folder is missing' : 'File is missing'}
              </h2>
              <p className="pt-2 text-sm text-[#a9c8bf]">
                {source?.isMissing
                  ? `The source folder path is unavailable. NexMP moved you to Missing files so you can review stored items from ${source.sourcePath}.`
                  : `${missingMedia.length} ${
                      missingMedia.length === 1 ? 'file is' : 'files are'
                    } missing and moved to the Missing files tab.`}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d]"
                type="button"
                onClick={() => setIsMissingAlertOpen(false)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {isDynamicOffConfirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div>
              <h2 className="text-lg font-bold">Turn off Dynamic?</h2>
              <p className="pt-2 text-sm text-[#a9c8bf]">
                {pendingMedia.length > 0
                  ? `This source still has ${pendingMedia.length} pending ${
                      pendingMedia.length === 1 ? 'item' : 'items'
                    }. Choose what to do before changing it to Manual.`
                  : 'Turning off Dynamic will make this source manual.'}{' '}
                This change is irreversible; Manual sources cannot be changed back to Dynamic.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setIsDynamicOffConfirmOpen(false)}
              >
                Cancel
              </button>
              {pendingMedia.length > 0 ? (
                <>
                  <button
                    className="rounded-lg border border-[#ff6f60]/35 px-4 py-2.5 font-bold text-[#ffaaa0] hover:bg-[#3e1c1f]/70"
                    type="button"
                    onClick={() => confirmDynamicOff('ignore')}
                  >
                    Ignore
                  </button>
                  <button
                    className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d]"
                    type="button"
                    onClick={() => confirmDynamicOff('approve')}
                  >
                    Approve
                  </button>
                </>
              ) : (
                <button
                  className="rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#220806]"
                  type="button"
                  onClick={() => confirmDynamicOff('ignore')}
                >
                  Turn off Dynamic
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {changePathPreview && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div>
              <h2 className="text-lg font-bold">Change dynamic folder path?</h2>
              <p className="pt-2 text-sm text-[#a9c8bf]">
                NexMP will use this folder as the new dynamic source path and scan all videos inside
                it. You cannot pick individual files for a dynamic folder.
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-black/20 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-[#00d982]">New path</p>
              <p className="break-all pt-1 text-sm text-[#f4fff8]">
                {changePathPreview.sourcePath}
              </p>
              <p className="pt-2 text-xs text-[#a9c8bf]">
                {changePathPreview.previewCount}{' '}
                {changePathPreview.previewCount === 1 ? 'video' : 'videos'} found.
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setChangePathPreview(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                type="button"
                onClick={() => void confirmDynamicPathChange()}
                disabled={isSaving}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
