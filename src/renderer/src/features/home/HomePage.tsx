import {
  CalendarDays,
  ChevronDown,
  FolderPlus,
  Pin,
  Play,
  Star,
  Text,
  Trash2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom'
import type { CollectionWithSources, MediaFile } from '../../../../shared/types/collection'
import { CollectionCard } from '../collections/CollectionCard'
import type { CollectionCardData } from '../collections/types'
import { createPlayablePlaylist, type PlayerRouteState } from '../collections/mediaPlayback'

type HomeLayoutContext = { openCollectionDialog: () => void }
type CollectionWithVideoCount = CollectionWithSources & { videoCount: number }
type SortBy = 'date' | 'name' | 'rating'

const HOME_COLLECTION_TILE_ZOOM_LEVELS = [
  { label: 'Compact', width: 176, skeletonHeight: 244 },
  { label: 'Normal', width: 208, skeletonHeight: 264 },
  { label: 'Large', width: 240, skeletonHeight: 286 },
  { label: 'Extra', width: 280, skeletonHeight: 314 }
] as const

const DEFAULT_HOME_COLLECTION_TILE_ZOOM_INDEX = 1

export function HomePage(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const { openCollectionDialog } = useOutletContext<HomeLayoutContext>()
  const [collections, setCollections] = useState<CollectionWithVideoCount[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renameCollection, setRenameCollection] = useState<CollectionWithVideoCount | null>(null)
  const [deleteCollection, setDeleteCollection] = useState<CollectionWithVideoCount | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isSavingAction, setIsSavingAction] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [isPinnedOpen, setIsPinnedOpen] = useState(true)
  const [pinViewMode, setPinViewMode] = useState<'section' | 'inline'>('section')
  const [tileZoomIndex, setTileZoomIndex] = useState(DEFAULT_HOME_COLLECTION_TILE_ZOOM_INDEX)
  const [playPickerCollection, setPlayPickerCollection] = useState<CollectionWithVideoCount | null>(
    null
  )
  const [playPickerMedia, setPlayPickerMedia] = useState<MediaFile[]>([])
  const [isPlayPickerLoading, setIsPlayPickerLoading] = useState(false)
  const returnTo = `${location.pathname}${location.search}`

  const fetchCollections = useCallback(async (): Promise<CollectionWithVideoCount[]> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return []
    }

    const collectionApi = window.api?.collections
    if (!collectionApi) throw new Error('Collection service is unavailable. Please restart NexMP.')

    const items = await collectionApi.list(profileId)
    const mediaLists = await Promise.all(
      items.map((collection) => collectionApi.listMedia(collection.id))
    )

    return items.map((collection, index) => ({
      ...collection,
      videoCount:
        mediaLists[index]?.filter((media) => !media.isMissing && !media.isPending).length ?? 0
    }))
  }, [navigate])

  const reloadCollections = async (): Promise<void> => {
    setCollections(await fetchCollections())
  }

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        const nextCollections = await fetchCollections()
        if (!isMounted) return
        setCollections(nextCollections)
      } catch (reason) {
        if (!isMounted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load collections.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [fetchCollections])

  const openPlayPicker = async (collection: CollectionCardData): Promise<void> => {
    try {
      setError(null)
      setIsPlayPickerLoading(true)
      setPlayPickerCollection(collections.find((item) => item.id === collection.id) ?? null)
      setPlayPickerMedia([])

      const mediaFiles = await window.api?.collections.listMedia(collection.id)
      const playableMedia = (mediaFiles ?? []).filter(
        (media) => !media.isMissing && !media.isPending
      )
      if (playableMedia.length === 0) {
        setPlayPickerCollection(null)
        setError('This collection does not have playable videos yet.')
        return
      }

      setPlayPickerMedia(playableMedia)
    } catch (reason) {
      setPlayPickerCollection(null)
      setError(reason instanceof Error ? reason.message : 'Unable to load playable videos.')
    } finally {
      setIsPlayPickerLoading(false)
    }
  }

  const openPickerMedia = (media: MediaFile): void => {
    const playlist = createPlayablePlaylist(playPickerMedia)
    const selectedIndex = Math.max(
      playlist.findIndex((video) => video.path === media.filePath),
      0
    )

    navigate('/player', {
      state: {
        playlist,
        selectedIndex,
        collectionName: playPickerCollection?.name,
        returnTo
      } satisfies PlayerRouteState
    })
  }

  const openAllPickerMedia = (): void => {
    const playlist = createPlayablePlaylist(playPickerMedia)
    if (playlist.length === 0) {
      setError('This collection does not have playable videos yet.')
      return
    }

    navigate('/player', {
      state: {
        playlist,
        selectedIndex: 0,
        collectionName: playPickerCollection?.name,
        returnTo
      } satisfies PlayerRouteState
    })
  }

  const openRenameModal = (collection: CollectionCardData): void => {
    const selected = collections.find((item) => item.id === collection.id) ?? null
    setRenameCollection(selected)
    setRenameValue(collection.name)
  }

  const openDeleteModal = (collection: CollectionCardData): void => {
    setDeleteCollection(collections.find((item) => item.id === collection.id) ?? null)
  }

  const submitRename = async (): Promise<void> => {
    if (!renameCollection) return
    try {
      setIsSavingAction(true)
      setError(null)
      await window.api?.collections.update({ id: renameCollection.id, name: renameValue })
      setRenameCollection(null)
      await reloadCollections()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to rename collection.')
    } finally {
      setIsSavingAction(false)
    }
  }

  const confirmDelete = async (): Promise<void> => {
    if (!deleteCollection) return
    try {
      setIsSavingAction(true)
      setError(null)
      await window.api?.collections.delete(deleteCollection.id)
      setDeleteCollection(null)
      await reloadCollections()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete collection.')
    } finally {
      setIsSavingAction(false)
    }
  }

  const updateCollectionMeta = async (
    collection: CollectionCardData,
    patch: { rating?: number; isPinned?: boolean }
  ): Promise<void> => {
    try {
      setError(null)
      await window.api?.collections.update({ id: collection.id, ...patch })
      await reloadCollections()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update collection.')
    }
  }

  const compareCollections = (
    firstCollection: CollectionWithVideoCount,
    secondCollection: CollectionWithVideoCount
  ): number => {
    if (sortBy === 'name') {
      return firstCollection.name.localeCompare(secondCollection.name, undefined, {
        numeric: true,
        sensitivity: 'base'
      })
    }
    if (sortBy === 'rating') {
      return (
        secondCollection.rating - firstCollection.rating ||
        firstCollection.name.localeCompare(secondCollection.name, undefined, {
          numeric: true,
          sensitivity: 'base'
        })
      )
    }

    return (
      new Date(secondCollection.updatedAt).getTime() -
        new Date(firstCollection.updatedAt).getTime() ||
      new Date(secondCollection.createdAt).getTime() - new Date(firstCollection.createdAt).getTime()
    )
  }

  const sortedCollections = [...collections].sort(compareCollections)
  const pinnedCollections = sortedCollections.filter((collection) => collection.isPinned)
  const unpinnedCollections = sortedCollections.filter((collection) => !collection.isPinned)
  const visibleCollections =
    pinViewMode === 'inline' ? [...pinnedCollections, ...unpinnedCollections] : unpinnedCollections
  const tileZoom = HOME_COLLECTION_TILE_ZOOM_LEVELS[tileZoomIndex]

  const zoomOutCollectionTiles = (): void => {
    setTileZoomIndex((current) => Math.max(0, current - 1))
  }

  const zoomInCollectionTiles = (): void => {
    setTileZoomIndex((current) =>
      Math.min(HOME_COLLECTION_TILE_ZOOM_LEVELS.length - 1, current + 1)
    )
  }

  const openCollectionDetail = (collectionId: string): void => {
    navigate(`/home/collections/${collectionId}`)
  }

  const isCollectionCardActionTarget = (eventTarget: EventTarget): boolean => {
    return (
      eventTarget instanceof HTMLElement &&
      eventTarget.closest('[data-collection-card-action="true"]') !== null
    )
  }

  const renderCollectionTile = (collection: CollectionWithVideoCount): React.JSX.Element => (
    <div
      key={collection.id}
      className="rounded-2xl border border-transparent p-2 transition hover:bg-white/[0.04]"
      style={{ width: tileZoom.width }}
      onClick={(event) => {
        if (isCollectionCardActionTarget(event.target)) return

        openCollectionDetail(collection.id)
      }}
      onContextMenu={(event) => event.stopPropagation()}
    >
      <CollectionCard
        viewMode="grid"
        collection={{
          ...collection,
          sourceCount: collection.sources.length,
          videoCount: collection.videoCount,
          rating: collection.rating,
          isPinned: collection.isPinned,
          updatedLabel: `Updated ${new Date(collection.updatedAt).toLocaleDateString()}`
        }}
        onOpen={(selectedCollection) => openCollectionDetail(selectedCollection.id)}
        onPlay={(selectedCollection) => void openPlayPicker(selectedCollection)}
        onEdit={(selectedCollection) =>
          navigate(`/home/collections/${selectedCollection.id}?edit=1`)
        }
        onRename={openRenameModal}
        onPin={(selectedCollection) =>
          void updateCollectionMeta(selectedCollection, {
            isPinned: !selectedCollection.isPinned
          })
        }
        onRate={(selectedCollection, rating) =>
          void updateCollectionMeta(selectedCollection, { rating })
        }
        onDelete={openDeleteModal}
      />
    </div>
  )

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#00d982]">YOUR LIBRARY</p>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to NexMP</h1>
          <p className="mt-2 text-[#a9c8bf]">
            Organize your folders into collections and keep watching where you left off.
          </p>
        </div>
        <button
          className="hidden items-center gap-2 rounded-lg border border-white/10 px-4 py-2.5 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 sm:flex"
          type="button"
          onClick={openCollectionDialog}
        >
          <FolderPlus size={18} />
          Add Collection
        </button>
      </div>

      {isLoading && (
        <section className="mt-10 flex flex-wrap items-start" aria-label="Loading collections">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]"
              style={{ width: tileZoom.width, height: tileZoom.skeletonHeight }}
            />
          ))}
        </section>
      )}

      {error && <p className="mt-10 text-[#ffaaa0]">{error}</p>}

      {!isLoading && !error && collections.length === 0 && (
        <section className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#00b875]/15 text-[#00d982]">
            <FolderPlus size={27} />
          </span>
          <h2 className="mt-5 text-xl font-bold">Start your first collection</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-[#a9c8bf]">
            A collection groups one or more video folders together. Your library stays separate for
            every profile.
          </p>
          <button
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-5 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982]"
            type="button"
            onClick={openCollectionDialog}
          >
            <FolderPlus size={18} />
            Add Collection
          </button>
        </section>
      )}

      {!isLoading && !error && collections.length > 0 && (
        <section className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">Collections</h2>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center overflow-hidden rounded-lg border border-white/10">
                <button
                  className="grid h-9 w-9 place-items-center text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8] disabled:opacity-40"
                  type="button"
                  onClick={zoomOutCollectionTiles}
                  disabled={tileZoomIndex === 0}
                  aria-label="Zoom out collections"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="min-w-16 border-x border-white/10 px-2 text-center text-xs font-bold text-[#a9c8bf]">
                  {tileZoom.label}
                </span>
                <button
                  className="grid h-9 w-9 place-items-center text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8] disabled:opacity-40"
                  type="button"
                  onClick={zoomInCollectionTiles}
                  disabled={tileZoomIndex === HOME_COLLECTION_TILE_ZOOM_LEVELS.length - 1}
                  aria-label="Zoom in collections"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
              <button
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                  pinViewMode === 'section'
                    ? 'border-[#00b875] bg-[#00b875]/15 text-[#00d982]'
                    : 'border-white/10 text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                }`}
                type="button"
                onClick={() =>
                  setPinViewMode((current) => (current === 'section' ? 'inline' : 'section'))
                }
              >
                <Pin size={16} />
                Pin on top
              </button>
              <span className="text-xs font-semibold text-[#a9c8bf]">Sort by</span>
              {[
                { value: 'date' as const, label: 'Date', icon: CalendarDays },
                { value: 'name' as const, label: 'Name', icon: Text },
                { value: 'rating' as const, label: 'Rating', icon: Star }
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold transition ${
                    sortBy === value
                      ? 'border-[#00b875] bg-[#00b875]/15 text-[#00d982]'
                      : 'border-white/10 text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                  }`}
                  type="button"
                  onClick={() => setSortBy(value)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          {pinViewMode === 'section' && pinnedCollections.length > 0 && (
            <div className="mb-9">
              <button
                className="mb-3 flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm font-bold text-[#00d982] transition hover:bg-white/5"
                type="button"
                onClick={() => setIsPinnedOpen((current) => !current)}
                aria-expanded={isPinnedOpen}
              >
                <span>
                  Pinned <span className="text-[#a9c8bf]">({pinnedCollections.length})</span>
                </span>
                <ChevronDown
                  className={`transition-transform ${isPinnedOpen ? 'rotate-0' : '-rotate-90'}`}
                  size={18}
                />
              </button>
              {isPinnedOpen && (
                <div className="flex flex-wrap items-start">
                  {pinnedCollections.map(renderCollectionTile)}
                </div>
              )}
            </div>
          )}
          {visibleCollections.length > 0 && (
            <div>
              {pinViewMode === 'section' && pinnedCollections.length > 0 && (
                <h3 className="mb-3 text-sm font-bold text-[#a9c8bf]">All collections</h3>
              )}
              <div className="flex flex-wrap items-start">
                {visibleCollections.map(renderCollectionTile)}
              </div>
            </div>
          )}
        </section>
      )}

      {playPickerCollection && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-2xl rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">Choose media</h2>
                <p className="mt-1 text-sm text-[#a9c8bf]">{playPickerCollection.name}</p>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={() => setPlayPickerCollection(null)}
                aria-label="Close media picker"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-sm text-[#a9c8bf]">
                {isPlayPickerLoading
                  ? 'Loading videos...'
                  : `${playPickerMedia.length} playable videos`}
              </p>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
                type="button"
                onClick={openAllPickerMedia}
                disabled={isPlayPickerLoading || playPickerMedia.length === 0}
              >
                <Play size={16} fill="currentColor" />
                Open all
              </button>
            </div>

            <div className="mt-4 max-h-[56vh] overflow-y-auto rounded-lg border border-white/10 bg-[#0d0f12]/70">
              {playPickerMedia.map((media) => (
                <button
                  key={media.id}
                  className="flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 text-left transition last:border-b-0 hover:bg-white/[0.06]"
                  type="button"
                  onClick={() => openPickerMedia(media)}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#00b875]/12 text-[#00d982]">
                    <Play size={16} fill="currentColor" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-[#f4fff8]">
                      {media.filename}
                    </span>
                    <span className="mt-1 block truncate text-xs text-[#a9c8bf]">
                      {media.sourceName} - {media.filePath}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {renameCollection && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-lg font-bold">Rename collection</h2>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={() => setRenameCollection(null)}
              >
                <X size={17} />
              </button>
            </div>
            <input
              className="mt-5 w-full rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-[#f4fff8] outline-none focus:border-[#00b875]"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={80}
              autoFocus
            />
            <div className="mt-5 flex justify-end">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setRenameCollection(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
                type="button"
                onClick={() => void submitRename()}
                disabled={!renameValue.trim() || isSavingAction}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteCollection && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-center">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#3e1c1f] text-[#ffaaa0]">
                <Trash2 size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold">Delete collection</h2>
                <p className="text-sm text-[#a9c8bf]">{deleteCollection.name}</p>
              </div>
            </div>
            <div className="mt-5 rounded-lg border border-white/10 bg-[#0d0f12]/70 p-4 text-sm text-[#a9c8bf]">
              <p>
                {deleteCollection.sources.length}{' '}
                {deleteCollection.sources.length === 1 ? 'folder' : 'folders'} -{' '}
                {deleteCollection.videoCount}{' '}
                {deleteCollection.videoCount === 1 ? 'video' : 'videos'}
              </p>
              {deleteCollection.sources.length > 0 && (
                <div className="mt-3 space-y-2">
                  {deleteCollection.sources.map((source) => (
                    <div key={source.id} className="truncate rounded-md bg-white/[0.04] px-3 py-2">
                      {source.name} - {source.sourcePath}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-[#ffaaa0]">
              This removes the collection, its sources, and saved media rows from the library.
            </p>
            <div className="mt-5 flex justify-end">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setDeleteCollection(null)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#220806] disabled:opacity-60"
                type="button"
                onClick={() => void confirmDelete()}
                disabled={isSavingAction}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
