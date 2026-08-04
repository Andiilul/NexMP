import { ArrowLeft, Check, FilePlus, FolderOpen, Play, Settings, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useState, type DragEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type {
  CollectionSource,
  CollectionWithSources,
  MediaFile,
  SourceMediaOrder,
  SourceMediaPreview
} from '../../../../shared/types/collection'
import { CollectionDataViewer } from './CollectionDataViewer'
import { createPlayablePlaylist, type PlayerRouteState } from './mediaPlayback'
import {
  MediaFilesViewer,
  type MediaEditDraft,
  type SmartRenameSaveInput
} from './MediaFilesViewer'
import { SourceCard } from './SourceCard'

type SourceEditDraft = {
  id: string
  name: string
  sortOrder: number
  source: CollectionSource
}

type AddSourceDraft = {
  sourcePath: string
  preview: SourceMediaPreview[]
  selectedFilePaths: string[]
}

export function CollectionDetailPage(): React.JSX.Element {
  const { collectionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [collection, setCollection] = useState<CollectionWithSources | null>(null)
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([])
  const [editName, setEditName] = useState('')
  const [editSources, setEditSources] = useState<SourceEditDraft[]>([])
  const [editMedia, setEditMedia] = useState<MediaEditDraft[]>([])
  const [isEditing, setIsEditing] = useState(searchParams.get('edit') === '1')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const [addSourceDynamic, setAddSourceDynamic] = useState(true)
  const [addSourceDraft, setAddSourceDraft] = useState<AddSourceDraft | null>(null)
  const [isConfirmPendingOpen, setIsConfirmPendingOpen] = useState(false)
  const returnTo = `${location.pathname}${location.search}`

  const applyEditState = (
    nextCollection: CollectionWithSources | null,
    nextMediaFiles: MediaFile[]
  ): void => {
    if (!nextCollection) return
    setEditName(nextCollection.name)
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
        .filter((media) => !media.isPending)
        .map((media, index) => ({
          id: media.id,
          filename: media.filename,
          sortOrder: index,
          media
        }))
    )
  }

  const fetchCollection = useCallback(async (): Promise<{
    nextCollection: CollectionWithSources | null
    nextMediaFiles: MediaFile[]
  }> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId || !collectionId) {
      navigate('/home')
      return { nextCollection: null, nextMediaFiles: [] }
    }

    const collectionApi = window.api?.collections
    if (!collectionApi) throw new Error('Collection service is unavailable. Please restart NexMP.')

    const [items, nextMediaFiles] = await Promise.all([
      collectionApi.list(profileId),
      collectionApi.listMedia(collectionId)
    ])

    return {
      nextCollection: items.find((item) => item.id === collectionId) ?? null,
      nextMediaFiles
    }
  }, [collectionId, navigate])

  const reload = useCallback(async (): Promise<void> => {
    const { nextCollection, nextMediaFiles } = await fetchCollection()
    setCollection(nextCollection)
    setMediaFiles(nextMediaFiles)
    applyEditState(nextCollection, nextMediaFiles)
  }, [fetchCollection])

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        const { nextCollection, nextMediaFiles } = await fetchCollection()
        if (!isMounted) return
        setCollection(nextCollection)
        setMediaFiles(nextMediaFiles)
        applyEditState(nextCollection, nextMediaFiles)
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
  const pendingMedia = mediaFiles.filter((media) => media.isPending && !media.isMissing)
  const isSingleFolder = collection?.sources.length === 1
  const singleSource = collection?.sources[0] ?? null
  const singleSourceMedia = singleSource
    ? mediaFiles.filter((media) => media.collectionSourceId === singleSource.id)
    : []
  const mediaCountBySource = mediaFiles.reduce<Record<string, number>>((counts, media) => {
    if (!media.isMissing && !media.isPending) {
      counts[media.collectionSourceId] = (counts[media.collectionSourceId] ?? 0) + 1
    }

    return counts
  }, {})

  const playCollection = (): void => {
    const playlist = createPlayablePlaylist(mediaFiles)
    if (playlist.length === 0) {
      setError('This collection does not have playable videos yet.')
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

  const updateSingleSourceMediaOrder = async (mediaOrder: SourceMediaOrder): Promise<void> => {
    if (!singleSource || !collectionId) return

    try {
      setError(null)
      const nextCollection = await window.api?.collections.updateSourceMediaOrder({
        sourceId: singleSource.id,
        mediaOrder
      })
      const nextMediaFiles = await window.api?.collections.listMedia(collectionId)

      setCollection(nextCollection ?? collection)
      setMediaFiles(nextMediaFiles ?? [])
      applyEditState(nextCollection ?? collection, nextMediaFiles ?? [])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update media order.')
    }
  }

  const saveSmartRename = async (renames: SmartRenameSaveInput[]): Promise<void> => {
    if (!collectionId) return

    const renameById = new Map(renames.map((rename) => [rename.id, rename.filename]))
    const baseMedia = isEditing
      ? editMedia
      : singleSourceMedia.map((media, index) => ({
          id: media.id,
          filename: media.filename,
          sortOrder: index,
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
          sortOrder: index
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
            sortOrder: index,
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
      await window.api?.collections.update({ id: collectionId, name: editName })
      if (isSingleFolder) {
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
            sortOrder: index
          }))
        )
      }
      await reload()
      setIsEditing(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save collection settings.')
    } finally {
      setIsSaving(false)
    }
  }

  const addMediaToSingleSource = async (): Promise<void> => {
    if (!singleSource) return

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
    setIsEditing(false)
  }

  const previewAddSource = async (sourcePath: string): Promise<void> => {
    const preview = await window.api?.collections.previewSourceMedia(sourcePath)
    setAddSourceDraft({
      sourcePath,
      preview: preview ?? [],
      selectedFilePaths: (preview ?? []).map((media) => media.filePath)
    })
  }

  const chooseAddSourceFolder = async (): Promise<void> => {
    try {
      setError(null)
      const selectedPaths = await window.api?.collections.selectSourceFolders()
      const sourcePath = selectedPaths?.[0]
      if (!sourcePath) return
      await previewAddSource(sourcePath)
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

    await previewAddSource(fileWithPath.path)
  }

  const addSource = async (): Promise<void> => {
    if (!collectionId || !addSourceDraft) return

    try {
      setIsSaving(true)
      setError(null)
      await window.api?.collections.addSource({
        collectionId,
        sourcePath: addSourceDraft.sourcePath,
        isDynamic: addSourceDynamic,
        includedFilePaths: addSourceDynamic ? undefined : addSourceDraft.selectedFilePaths
      })
      setIsAddSourceOpen(false)
      setAddSourceDraft(null)
      await reload()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to add source.')
    } finally {
      setIsSaving(false)
    }
  }

  const confirmPendingMedia = async (): Promise<void> => {
    if (!collectionId) return

    try {
      setIsSaving(true)
      setError(null)
      const nextMediaFiles = await window.api?.collections.confirmPendingMedia(collectionId)
      setMediaFiles(nextMediaFiles ?? [])
      setIsConfirmPendingOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to confirm new files.')
    } finally {
      setIsSaving(false)
    }
  }

  if (!collection && !error) return <p className="text-[#a9c8bf]">Loading collection...</p>

  return (
    <div className="mx-auto max-w-6xl">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate('/home')}
      >
        <ArrowLeft size={17} />
        Back to Home
      </button>

      {error && (
        <p className="mt-6 rounded-lg border border-[#ff6f60]/25 bg-[#3e1c1f]/60 px-4 py-3 text-sm text-[#ffaaa0]">
          {error}
        </p>
      )}

      {collection && (
        <>
          <div className="mt-7 flex items-end justify-between gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#00d982]">COLLECTION</p>
              {isEditing ? (
                <input
                  className="mt-2 w-full max-w-xl rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-2xl font-bold text-[#f4fff8] outline-none focus:border-[#00b875]"
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                  maxLength={80}
                />
              ) : (
                <h1 className="mt-2 truncate text-3xl font-bold">{collection.name}</h1>
              )}
              <p className="mt-2 text-sm text-[#a9c8bf]">
                {collection.sources.length} {collection.sources.length === 1 ? 'folder' : 'folders'}{' '}
                - {playableMedia.length} {playableMedia.length === 1 ? 'video' : 'videos'}
              </p>
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
                    disabled={!editName.trim() || isSaving}
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
                  {isSingleFolder && (
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

          {pendingMedia.length > 0 && (
            <section className="mt-8 rounded-xl border border-[#00b875]/25 bg-[#00b875]/[0.06] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="font-bold text-[#f4fff8]">New files found</h2>
                  <p className="mt-1 text-sm text-[#a9c8bf]">
                    {pendingMedia.length} new {pendingMedia.length === 1 ? 'video' : 'videos'} need
                    confirmation before they enter the playlist.
                  </p>
                </div>
                <button
                  className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d]"
                  type="button"
                  onClick={() => setIsConfirmPendingOpen(true)}
                >
                  Review New
                </button>
              </div>
            </section>
          )}

          {isSingleFolder && (
            <MediaFilesViewer
              title={isEditing ? 'Video settings' : 'Videos'}
              mediaFiles={singleSourceMedia}
              editMedia={editMedia}
              isEditing={isEditing}
              orderBy={singleSource?.mediaOrder ?? 'name'}
              onOrderChange={updateSingleSourceMediaOrder}
              onMove={moveMedia}
              onPlay={playMedia}
              onRenameDraft={renameMediaDraft}
              onSmartRenameSave={saveSmartRename}
              emptyLabel={isEditing ? 'No videos.' : 'No videos found yet.'}
            />
          )}

          {isEditing && !isSingleFolder && (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold">Collection settings</h2>
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
                renderItem={(source, viewMode) => (
                  <div className="flex gap-3">
                    <input
                      className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0d0f12] px-3 py-2 text-sm text-[#f4fff8] outline-none focus:border-[#00b875]"
                      value={source.name}
                      onChange={(event) =>
                        setEditSources((current) =>
                          current.map((item) =>
                            item.id === source.id ? { ...item, name: event.target.value } : item
                          )
                        )
                      }
                    />
                    <button
                      className="grid h-10 w-10 place-items-center rounded-lg text-[#ffaaa0] hover:bg-[#3e1c1f]/70"
                      type="button"
                      onClick={() => removeSourceDraft(source.id)}
                      aria-label={`Delete ${source.name}`}
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className="hidden">
                      <SourceCard
                        source={source.source}
                        viewMode={viewMode}
                        videoCount={mediaCountBySource[source.id] ?? 0}
                      />
                    </div>
                  </div>
                )}
              />
            </section>
          )}

          {!isEditing && !isSingleFolder && (
            <section className="mt-10">
              <h2 className="mb-4 text-lg font-bold">Folders</h2>
              <CollectionDataViewer
                items={collection.sources}
                getId={(source) => source.id}
                emptyState={
                  <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
                    <FolderOpen className="mx-auto mb-3" />
                    No sources added yet.
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
          <div className="flex max-h-[86vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
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
              className="mt-5 rounded-xl border border-dashed border-white/20 bg-[#0d0f12]/70 px-4 py-8 text-left hover:border-[#00b875]/70"
              type="button"
              onClick={() => void chooseAddSourceFolder()}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => void dropAddSourceFolder(event)}
            >
              <span className="flex items-center gap-3">
                <FolderOpen className="text-[#00d982]" size={22} />
                <span className="min-w-0">
                  <span className="block font-semibold">
                    {addSourceDraft ? addSourceDraft.sourcePath : 'Click or drag a folder here'}
                  </span>
                  <span className="mt-1 block text-sm text-[#a9c8bf]">
                    {addSourceDraft
                      ? `${addSourceDraft.preview.length} videos found`
                      : 'The folder picker is used when drag path is unavailable.'}
                  </span>
                </span>
              </span>
            </button>
            <label className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-[#f4fff8]">Dynamic source</span>
                <span className="mt-0.5 block text-xs text-[#a9c8bf]">
                  Future rescans create New cards before adding them to playback.
                </span>
              </span>
              <input
                className="h-5 w-5 accent-[#00b875]"
                type="checkbox"
                checked={addSourceDynamic}
                onChange={(event) => setAddSourceDynamic(event.target.checked)}
              />
            </label>
            {addSourceDraft && !addSourceDynamic && (
              <div className="mt-4 min-h-0 overflow-y-auto rounded-lg border border-white/10">
                {addSourceDraft.preview.map((media) => (
                  <label
                    key={media.filePath}
                    className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
                  >
                    <input
                      className="h-4 w-4 accent-[#00b875]"
                      type="checkbox"
                      checked={addSourceDraft.selectedFilePaths.includes(media.filePath)}
                      onChange={(event) => {
                        setAddSourceDraft((current) => {
                          if (!current) return current
                          const selectedFilePaths = event.target.checked
                            ? [...new Set([...current.selectedFilePaths, media.filePath])]
                            : current.selectedFilePaths.filter((path) => path !== media.filePath)
                          return { ...current, selectedFilePaths }
                        })
                      }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{media.filename}</span>
                      <span className="block truncate text-xs text-[#a9c8bf]">
                        {media.filePath}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setIsAddSourceOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                type="button"
                onClick={() => void addSource()}
                disabled={!addSourceDraft || isSaving}
              >
                Add Source
              </button>
            </div>
          </div>
        </div>
      )}

      {isConfirmPendingOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <h2 className="text-lg font-bold">Confirm new files</h2>
            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-white/10">
              {pendingMedia.map((media) => (
                <div
                  key={media.id}
                  className="border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
                >
                  <p className="truncate text-sm font-semibold">{media.filename}</p>
                  <p className="truncate text-xs text-[#a9c8bf]">{media.sourceName}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setIsConfirmPendingOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                type="button"
                onClick={() => void confirmPendingMedia()}
                disabled={isSaving}
              >
                Add New Files
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
