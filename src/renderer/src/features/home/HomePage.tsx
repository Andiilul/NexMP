import {
  CalendarDays,
  ChevronDown,
  FolderPlus,
  Pin,
  Play,
  Search,
  SearchX,
  Star,
  Text,
  Trash2,
  X,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import type { CollectionSearchResult, MediaFile, Tag } from '../../../../shared/types/collection'
import { CollectionCard } from '../collections/CollectionCard'
import type { CollectionCardData } from '../collections/types'
import { createPlayablePlaylist, type PlayerRouteState } from '../collections/mediaPlayback'
import { useAppState } from '../../components/useAppState'
import { useToast } from '../../components/useToast'
import { formatTagName } from '../tags/tagDisplay'

type HomeLayoutContext = { openCollectionDialog: () => void }
type HomeCollection = CollectionSearchResult & {
  videoCount: number
  mediaForCollection: MediaFile[]
}
type SortBy = 'date' | 'name' | 'rating'
type TagMatchMode = 'all' | 'any'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const { openCollectionDialog } = useOutletContext<HomeLayoutContext>()
  const { warning } = useToast()
  const [collections, setCollections] = useState<HomeCollection[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>('all')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [renameCollection, setRenameCollection] = useState<HomeCollection | null>(null)
  const [deleteCollection, setDeleteCollection] = useState<HomeCollection | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [isSavingAction, setIsSavingAction] = useState(false)
  const [sortBy, setSortBy] = useState<SortBy>('date')
  const [isPinnedOpen, setIsPinnedOpen] = useState(true)
  const {
    appState: { pinOnTop },
    togglePinOnTop
  } = useAppState()
  const [tileZoomIndex, setTileZoomIndex] = useState(DEFAULT_HOME_COLLECTION_TILE_ZOOM_INDEX)
  const [playPickerCollection, setPlayPickerCollection] = useState<HomeCollection | null>(null)
  const [playPickerMedia, setPlayPickerMedia] = useState<MediaFile[]>([])
  const [selectedPlayPickerMediaIds, setSelectedPlayPickerMediaIds] = useState<string[]>([])
  const [isPlayPickerLoading, setIsPlayPickerLoading] = useState(false)
  const returnTo = `${location.pathname}${location.search}`

  const selectedTagIds = useMemo(
    () =>
      (searchParams.get('tags') ?? '')
        .split(',')
        .map((tagId) => tagId.trim())
        .filter(Boolean),
    [searchParams]
  )

  const fetchCollections = useCallback(async (): Promise<{
    collections: HomeCollection[]
    tags: Tag[]
  }> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return { collections: [], tags: [] }
    }

    const collectionApi = window.api?.collections
    if (!collectionApi) throw new Error('Collection service is unavailable. Please restart NexMP.')

    const [items, nextTags] = await Promise.all([
      collectionApi.search(profileId, '', []),
      collectionApi.listTags(profileId)
    ])

    return {
      collections: items.map((collection) => {
        const mediaForCollection = collection.mediaForCollection ?? []
        return {
          ...collection,
          mediaForCollection,
          videoCount: mediaForCollection.filter((media) => !media.isMissing && !media.isPending)
            .length
        }
      }),
      tags: nextTags ?? []
    }
  }, [navigate])

  const reloadCollections = async (): Promise<void> => {
    const nextLibrary = await fetchCollections()
    setCollections(nextLibrary.collections)
    setTags(nextLibrary.tags)
  }

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        const nextLibrary = await fetchCollections()
        if (!isMounted) return
        setCollections(nextLibrary.collections)
        setTags(nextLibrary.tags)
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
      setSelectedPlayPickerMediaIds([])

      const mediaFiles = await window.api?.collections.listMedia(collection.id)
      const playableMedia = (mediaFiles ?? []).filter(
        (media) => !media.isMissing && !media.isPending
      )
      if (playableMedia.length === 0) {
        setPlayPickerCollection(null)
        warning('This collection does not have playable videos yet.')
        return
      }

      setPlayPickerMedia(playableMedia)
      setSelectedPlayPickerMediaIds(playableMedia.map((media) => media.id))
    } catch (reason) {
      setPlayPickerCollection(null)
      setSelectedPlayPickerMediaIds([])
      warning(reason instanceof Error ? reason.message : 'Unable to load playable videos.')
    } finally {
      setIsPlayPickerLoading(false)
    }
  }

  const selectedPlayPickerMedia = playPickerMedia.filter((media) =>
    selectedPlayPickerMediaIds.includes(media.id)
  )

  const closePlayPicker = (): void => {
    setPlayPickerCollection(null)
    setPlayPickerMedia([])
    setSelectedPlayPickerMediaIds([])
  }

  const togglePlayPickerMedia = (mediaId: string): void => {
    setSelectedPlayPickerMediaIds((currentIds) =>
      currentIds.includes(mediaId)
        ? currentIds.filter((id) => id !== mediaId)
        : [...currentIds, mediaId]
    )
  }

  const selectAllPlayPickerMedia = (): void => {
    setSelectedPlayPickerMediaIds(playPickerMedia.map((media) => media.id))
  }

  const clearPlayPickerMedia = (): void => {
    setSelectedPlayPickerMediaIds([])
  }

  const openPickerMedia = (media: MediaFile): void => {
    const playlist = createPlayablePlaylist(selectedPlayPickerMedia)
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
    const playlist = createPlayablePlaylist(selectedPlayPickerMedia)
    if (playlist.length === 0) {
      warning('Select at least one video to play.')
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
    firstCollection: HomeCollection,
    secondCollection: HomeCollection
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

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    collections.forEach((collection) => {
      collection.tags.forEach((tag) => counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1))
    })
    return counts
  }, [collections])

  const filteredCollections = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase()
    const selectedTags = new Set(selectedTagIds)

    return collections.filter((collection) => {
      const searchableText = [
        collection.name,
        ...collection.sources.map((source) => source.name),
        ...collection.mediaForCollection.map((media) => media.filename),
        ...collection.tags.map((tag) => tag.name)
      ]
        .join(' ')
        .toLocaleLowerCase()

      const matchesQuery = !normalizedQuery || searchableText.includes(normalizedQuery)
      const collectionTagIds = new Set(collection.tags.map((tag) => tag.id))
      const matchesTags =
        selectedTags.size === 0 ||
        (tagMatchMode === 'all'
          ? selectedTagIds.every((tagId) => collectionTagIds.has(tagId))
          : selectedTagIds.some((tagId) => collectionTagIds.has(tagId)))

      return matchesQuery && matchesTags
    })
  }, [collections, searchQuery, selectedTagIds, tagMatchMode])

  const sortedCollections = [...filteredCollections].sort(compareCollections)
  const pinnedCollections = sortedCollections.filter((collection) => collection.isPinned)
  const unpinnedCollections = sortedCollections.filter((collection) => !collection.isPinned)
  const visibleCollections = pinOnTop
    ? unpinnedCollections
    : [...pinnedCollections, ...unpinnedCollections]
  const tileZoom = HOME_COLLECTION_TILE_ZOOM_LEVELS[tileZoomIndex]

  const zoomOutCollectionTiles = (): void => {
    setTileZoomIndex((current) => Math.max(0, current - 1))
  }

  const zoomInCollectionTiles = (): void => {
    setTileZoomIndex((current) =>
      Math.min(HOME_COLLECTION_TILE_ZOOM_LEVELS.length - 1, current + 1)
    )
  }

  const openCollection = (collectionId: string, search = ''): void => {
    navigate(`/home/collections/${collectionId}${search}`)
  }

  const setSelectedTagIds = (tagIds: string[]): void => {
    const nextSearchParams = new URLSearchParams(searchParams)
    if (tagIds.length > 0) {
      nextSearchParams.set('tags', tagIds.join(','))
    } else {
      nextSearchParams.delete('tags')
    }
    setSearchParams(nextSearchParams, { replace: true })
  }

  const toggleTagFilter = (tagId: string): void => {
    setSelectedTagIds(
      selectedTagIds.includes(tagId)
        ? selectedTagIds.filter((selectedTagId) => selectedTagId !== tagId)
        : [...selectedTagIds, tagId]
    )
  }

  const hasActiveFilters = searchQuery.trim() || selectedTagIds.length > 0

  const isCollectionCardActionTarget = (eventTarget: EventTarget): boolean => {
    return (
      eventTarget instanceof HTMLElement &&
      eventTarget.closest('[data-collection-card-action="true"]') !== null
    )
  }

  const renderCollectionTile = (collection: HomeCollection): React.JSX.Element => (
    <div
      key={collection.id}
      className="rounded-2xl border border-transparent p-2 transition hover:bg-white/[0.04]"
      style={{ width: tileZoom.width }}
      onClick={(event) => {
        if (isCollectionCardActionTarget(event.target)) return

        openCollection(collection.id)
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
        onOpen={(selectedCollection) => openCollection(selectedCollection.id)}
        onPlay={(selectedCollection) => void openPlayPicker(selectedCollection)}
        onEdit={(selectedCollection) => openCollection(selectedCollection.id, '?edit=1')}
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
    <div className="flex w-full max-w-6xl flex-col gap-8">
      <div className="flex items-end justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-sm font-semibold text-[#00d982]">YOUR LIBRARY</p>
          <h1 className="text-3xl font-bold tracking-tight">Welcome to NexMP</h1>
          <p className="text-[#a9c8bf]">
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

      <section className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <label className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-[#0d0f12] px-4 py-3 text-[#a9c8bf] focus-within:border-[#00b875]/70">
          <Search size={19} />
          <input
            className="w-full bg-transparent text-sm text-[#f4fff8] outline-none placeholder:text-[#a9c8bf]/60"
            placeholder="Search collections, folders, tags, and videos"
            aria-label="Search collections, folders, tags, and videos"
            data-nexmp-search-target="true"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
          {searchQuery && (
            <button
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-[#a9c8bf]">
              Filter tags
            </span>
            {isLoading ? (
              <span className="text-sm text-[#a9c8bf]/70">Loading tags...</span>
            ) : tags.length === 0 ? (
              <span className="text-sm text-[#a9c8bf]/70">No tags yet.</span>
            ) : (
              tags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                      isSelected
                        ? 'border-transparent text-[#04120d]'
                        : 'border-white/15 text-[#a9c8bf] hover:border-white/30 hover:text-[#f4fff8]'
                    }`}
                    style={isSelected ? { backgroundColor: tag.color } : undefined}
                    type="button"
                    onClick={() => toggleTagFilter(tag.id)}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {formatTagName(tag.name)}
                    <span className="opacity-70">{tagCounts.get(tag.id) ?? 0}</span>
                  </button>
                )
              })
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {selectedTagIds.length > 1 && (
              <div className="inline-flex overflow-hidden rounded-lg border border-white/10">
                {[
                  { value: 'all' as const, label: 'All selected tags' },
                  { value: 'any' as const, label: 'Any selected tag' }
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`px-3 py-2 text-xs font-bold transition ${
                      tagMatchMode === option.value
                        ? 'bg-[#00b875]/15 text-[#00d982]'
                        : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                    }`}
                    type="button"
                    onClick={() => setTagMatchMode(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            {hasActiveFilters && (
              <button
                className="rounded-lg border border-white/10 px-3 py-2 text-xs font-bold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedTagIds([])
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      </section>

      {isLoading && (
        <section className="flex flex-wrap items-start" aria-label="Loading collections">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-64 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]"
              style={{ width: tileZoom.width, height: tileZoom.skeletonHeight }}
            />
          ))}
        </section>
      )}

      {error && <p className="text-[#ffaaa0]">{error}</p>}

      {!isLoading && !error && collections.length === 0 && (
        <section className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#00b875]/15 text-[#00d982]">
            <FolderPlus size={27} />
          </span>
          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-xl font-bold">Start your first collection</h2>
            <p className="text-sm text-[#a9c8bf]">
              A collection groups one or more video folders together. Your library stays separate
              for every profile.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-5 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982]"
            type="button"
            onClick={openCollectionDialog}
          >
            <FolderPlus size={18} />
            Add Collection
          </button>
        </section>
      )}

      {!isLoading && !error && collections.length > 0 && filteredCollections.length === 0 && (
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-14 text-center">
          <SearchX className="text-[#a9c8bf]" size={30} />
          <div className="flex flex-col gap-2">
            <h2 className="text-xl font-bold">No collections matched</h2>
            <p className="text-sm text-[#a9c8bf]">
              Try another keyword, clear a tag, or switch the tag match mode.
            </p>
          </div>
        </section>
      )}

      {!isLoading && !error && filteredCollections.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-bold">
              Collections{' '}
              <span className="text-sm font-semibold text-[#a9c8bf]">
                ({filteredCollections.length})
              </span>
            </h2>
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
                  pinOnTop
                    ? 'border-[#00b875] bg-[#00b875]/15 text-[#00d982]'
                    : 'border-white/10 text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                }`}
                type="button"
                onClick={togglePinOnTop}
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
          {pinOnTop && pinnedCollections.length > 0 && (
            <div className="flex flex-col gap-3 pb-5">
              <button
                className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm font-bold text-[#00d982] transition hover:bg-white/5"
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
            <div className="flex flex-col gap-3">
              {pinOnTop && pinnedCollections.length > 0 && (
                <h3 className="text-sm font-bold text-[#a9c8bf]">All collections</h3>
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
          <div className="flex w-full max-w-2xl flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold">Choose media</h2>
                <p className="text-sm text-[#a9c8bf]">{playPickerCollection.name}</p>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={closePlayPicker}
                aria-label="Close media picker"
              >
                <X size={17} />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-[#a9c8bf]">
                  {isPlayPickerLoading
                    ? 'Loading videos...'
                    : `${selectedPlayPickerMedia.length} of ${playPickerMedia.length} selected`}
                </p>
                <p className="text-xs text-[#a9c8bf]/75">Order follows each folder setting.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8] disabled:opacity-60"
                  type="button"
                  onClick={selectAllPlayPickerMedia}
                  disabled={
                    isPlayPickerLoading ||
                    playPickerMedia.length === 0 ||
                    selectedPlayPickerMedia.length === playPickerMedia.length
                  }
                >
                  Select all
                </button>
                <button
                  className="rounded-lg border border-white/10 px-3 py-2 text-sm font-bold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8] disabled:opacity-60"
                  type="button"
                  onClick={clearPlayPickerMedia}
                  disabled={isPlayPickerLoading || selectedPlayPickerMedia.length === 0}
                >
                  Clear
                </button>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
                  type="button"
                  onClick={openAllPickerMedia}
                  disabled={isPlayPickerLoading || selectedPlayPickerMedia.length === 0}
                >
                  <Play size={16} fill="currentColor" />
                  Open selected
                </button>
              </div>
            </div>

            <div className="max-h-[56vh] overflow-y-auto rounded-lg border border-white/10 bg-[#0d0f12]/70">
              {playPickerMedia.map((media) => {
                const isSelected = selectedPlayPickerMediaIds.includes(media.id)

                return (
                  <div
                    key={media.id}
                    className={`flex w-full items-center gap-3 border-b border-white/[0.06] px-4 py-3 transition last:border-b-0 ${
                      isSelected ? 'bg-white/[0.035]' : 'opacity-60 hover:opacity-100'
                    }`}
                  >
                    <input
                      className="h-4 w-4 shrink-0 accent-[#00b875]"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => togglePlayPickerMedia(media.id)}
                      aria-label={`Include ${media.filename}`}
                    />
                    <button
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#00b875]/12 text-[#00d982] transition hover:bg-[#00b875]/20 disabled:opacity-40"
                      type="button"
                      onClick={() => openPickerMedia(media)}
                      disabled={!isSelected}
                      aria-label={`Play from ${media.filename}`}
                    >
                      <Play size={16} fill="currentColor" />
                    </button>
                    <button
                      className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                      type="button"
                      onClick={() => togglePlayPickerMedia(media.id)}
                    >
                      <span className="block truncate text-sm font-bold text-[#f4fff8]">
                        {media.filename}
                      </span>
                      <span className="block truncate text-xs text-[#a9c8bf]">
                        {media.sourceName} - {media.filePath}
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {renameCollection && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex w-full max-w-md flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
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
              className="w-full rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-[#f4fff8] outline-none focus:border-[#00b875]"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              maxLength={80}
              autoFocus
            />
            <div className="flex justify-end">
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
          <div className="flex w-full max-w-lg flex-col gap-5 rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#3e1c1f] text-[#ffaaa0]">
                <Trash2 size={20} />
              </span>
              <div>
                <h2 className="text-lg font-bold">Delete collection</h2>
                <p className="text-sm text-[#a9c8bf]">{deleteCollection.name}</p>
              </div>
            </div>
            <div className="rounded-lg border border-white/10 bg-[#0d0f12]/70 p-4 text-sm text-[#a9c8bf]">
              <p>
                {deleteCollection.sources.length}{' '}
                {deleteCollection.sources.length === 1 ? 'folder' : 'folders'} -{' '}
                {deleteCollection.videoCount}{' '}
                {deleteCollection.videoCount === 1 ? 'video' : 'videos'}
              </p>
              {deleteCollection.sources.length > 0 && (
                <div className="flex flex-col gap-2 pt-3">
                  {deleteCollection.sources.map((source) => (
                    <div key={source.id} className="truncate rounded-md bg-white/[0.04] px-3 py-2">
                      {source.name} - {source.sourcePath}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-sm text-[#ffaaa0]">
              This removes the collection, its sources, and saved media rows from the library.
            </p>
            <div className="flex justify-end">
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
