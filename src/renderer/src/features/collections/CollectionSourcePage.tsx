import { ArrowLeft, Check, FilePlus, Pencil, Play, RefreshCw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
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

export function CollectionSourcePage(): React.JSX.Element {
  const { collectionId, sourceId } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { warning } = useToast()
  const [collection, setCollection] = useState<CollectionWithSources | null>(null)
  const [source, setSource] = useState<CollectionSource | null>(null)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [editSourceName, setEditSourceName] = useState('')
  const [editMedia, setEditMedia] = useState<MediaEditDraft[]>([])
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1')
  const [isSaving, setIsSaving] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const returnTo = `${location.pathname}${location.search}`

  const applyEditState = (
    nextSource: CollectionSource | null,
    nextMediaFiles: MediaFile[]
  ): void => {
    if (!nextSource) return
    setEditSourceName(nextSource.name)
    setEditMedia(
      nextMediaFiles.map((media, index) => ({
        id: media.id,
        filename: media.filename,
        sortOrder: index,
        media
      }))
    )
  }

  const fetchSource = useCallback(async (): Promise<{
    nextCollection: CollectionWithSources | null
    nextSource: CollectionSource | null
    nextMediaFiles: MediaFile[]
  }> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId || !collectionId || !sourceId) {
      navigate('/home')
      return { nextCollection: null, nextSource: null, nextMediaFiles: [] }
    }

    const collectionApi = window.api?.collections
    if (!collectionApi) throw new Error('Collection service is unavailable. Please restart NexMP.')

    const [items, nextMediaFiles] = await Promise.all([
      collectionApi.list(profileId),
      collectionApi.listSourceMedia(sourceId)
    ])
    const nextCollection = items.find((item) => item.id === collectionId) ?? null
    const nextSource = nextCollection?.sources.find((item) => item.id === sourceId) ?? null

    return { nextCollection, nextSource, nextMediaFiles }
  }, [collectionId, navigate, sourceId])

  const reload = useCallback(async (): Promise<void> => {
    const { nextCollection, nextSource, nextMediaFiles } = await fetchSource()
    setCollection(nextCollection)
    setSource(nextSource)
    setMediaFiles(nextMediaFiles)
    applyEditState(nextSource, nextMediaFiles)
  }, [fetchSource])

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        const { nextCollection, nextSource, nextMediaFiles } = await fetchSource()
        if (!isMounted) return
        setCollection(nextCollection)
        setSource(nextSource)
        setMediaFiles(nextMediaFiles)
        applyEditState(nextSource, nextMediaFiles)
      } catch (reason) {
        if (!isMounted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load this source.')
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [fetchSource])

  const playableMedia = mediaFiles.filter((media) => !media.isMissing && !media.isPending)

  const playMedia = (media: MediaFile): void => {
    if (media.isMissing) {
      setError(`File not available: ${media.filePath}`)
      return
    }
    if (media.isPending) {
      setError('Confirm this new file from the collection screen before playback.')
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

  const playSource = (): void => {
    const playlist = createPlayablePlaylist(mediaFiles)
    if (playlist.length === 0) {
      warning('This source does not have playable videos yet.')
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
        { id: source.id, name: editSourceName, sortOrder: source.sortOrder }
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
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save source changes.')
    } finally {
      setIsSaving(false)
    }
  }

  const rescanSource = async (): Promise<void> => {
    if (!sourceId || !source?.isDynamic) return

    try {
      setIsScanning(true)
      setError(null)
      const nextMediaFiles = await window.api?.collections.rescanSource(sourceId)
      setMediaFiles((nextMediaFiles ?? []).filter((media) => media.collectionSourceId === sourceId))
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to rescan this source.')
    } finally {
      setIsScanning(false)
    }
  }

  const addMedia = async (): Promise<void> => {
    if (!sourceId) return

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

  const renameMediaDraft = (mediaId: string, filename: string): void => {
    setEditMedia((current) =>
      current.map((media) =>
        media.id === mediaId ? { ...media, filename, media: { ...media.media, filename } } : media
      )
    )
  }

  const saveMediaRename = async (mediaId: string, filename: string): Promise<void> => {
    if (!collectionId) return

    const baseMedia = [...mediaFiles].sort((firstMedia, secondMedia) => {
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
      : [...mediaFiles]
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
                {source.sourcePath} - {playableMedia.length}{' '}
                {playableMedia.length === 1 ? 'video' : 'videos'}
              </p>
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
                  {source.isDynamic && (
                    <button
                      className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                      type="button"
                      onClick={() => void rescanSource()}
                      disabled={isScanning}
                    >
                      <RefreshCw size={18} />
                      {isScanning ? 'Scanning...' : 'Rescan'}
                    </button>
                  )}
                  <button
                    className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 font-bold text-[#f4fff8] transition hover:bg-white/5"
                    type="button"
                    onClick={() => void addMedia()}
                  >
                    <FilePlus size={18} />
                    Add Media
                  </button>
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

          <MediaFilesViewer
            title="Videos"
            mediaFiles={mediaFiles}
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
        </>
      )}
    </div>
  )
}
