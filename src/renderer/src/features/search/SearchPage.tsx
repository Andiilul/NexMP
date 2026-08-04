import { ArrowLeft, Grid2X2, List, SearchX } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { CollectionSearchResult, Tag } from '../../../../shared/types/collection'
import { CollectionCard } from '../collections/CollectionCard'
import { createPlayablePlaylist, type PlayerRouteState } from '../collections/mediaPlayback'
import type { CollectionCardData } from '../collections/types'
import type { LibraryViewMode } from '../collections/types'

type SearchResultWithVideoCount = CollectionSearchResult & { videoCount: number }

export function SearchPage(): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const query = new URLSearchParams(location.search).get('q') ?? ''
  const returnTo = `${location.pathname}${location.search}`
  const profileId = sessionStorage.getItem('nexmp.active-profile-id')
  const [results, setResults] = useState<SearchResultWithVideoCount[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<LibraryViewMode>('grid')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profileId) {
      navigate('/')
      return
    }

    void Promise.resolve()
      .then(() => {
        const collectionApi = window.api?.collections
        if (!collectionApi)
          throw new Error('Collection service is unavailable. Please restart NexMP.')

        setIsLoading(true)
        setError(null)
        return Promise.all([
          collectionApi.search(profileId, query, selectedTagIds),
          collectionApi.listTags(profileId)
        ]).then(async ([nextResults, nextTags]) => {
          const mediaLists = await Promise.all(
            nextResults.map((collection) => collectionApi.listMedia(collection.id))
          )

          return [
            nextResults.map((collection, index) => ({
              ...collection,
              videoCount:
                mediaLists[index]?.filter((media) => !media.isMissing && !media.isPending).length ??
                0
            })),
            nextTags
          ] as const
        })
      })
      .then(([nextResults, nextTags]) => {
        setResults(nextResults)
        setTags(nextTags)
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : 'Unable to search your collections.')
      )
      .finally(() => setIsLoading(false))
  }, [navigate, profileId, query, selectedTagIds])

  const toggleTag = (tagId: string): void => {
    setSelectedTagIds((current) =>
      current.includes(tagId) ? current.filter((id) => id !== tagId) : [...current, tagId]
    )
  }

  const playCollection = async (collection: CollectionCardData): Promise<void> => {
    try {
      setError(null)
      const mediaFiles = await window.api?.collections.listMedia(collection.id)
      const playlist = createPlayablePlaylist(mediaFiles ?? [])
      if (playlist.length === 0) {
        setError('This collection does not have playable videos yet.')
        return
      }

      navigate('/player', {
        state: {
          playlist,
          selectedIndex: 0,
          collectionName: collection.name,
          returnTo
        } satisfies PlayerRouteState
      })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to play this collection.')
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] transition hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate('/home')}
      >
        <ArrowLeft size={17} />
        Back
      </button>
      <div className="mt-7 flex items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#00d982]">SEARCH</p>
          <h1 className="text-3xl font-bold tracking-tight">Results for &quot;{query}&quot;</h1>
          <p className="mt-2 text-[#a9c8bf]">
            {isLoading
              ? 'Searching...'
              : `${results.length} collection${results.length === 1 ? '' : 's'} found`}
          </p>
        </div>
        <div className="flex rounded-lg border border-white/10 p-1">
          <button
            className={`grid h-8 w-8 place-items-center rounded-md ${viewMode === 'grid' ? 'bg-white/10 text-[#f4fff8]' : 'text-[#a9c8bf]'}`}
            type="button"
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid2X2 size={17} />
          </button>
          <button
            className={`grid h-8 w-8 place-items-center rounded-md ${viewMode === 'list' ? 'bg-white/10 text-[#f4fff8]' : 'text-[#a9c8bf]'}`}
            type="button"
            onClick={() => setViewMode('list')}
            aria-label="List view"
          >
            <List size={17} />
          </button>
        </div>
      </div>
      <section className="mt-8">
        <h2 className="text-sm font-bold text-[#a9c8bf]">FILTER BY TAG</h2>
        {tags.length === 0 ? (
          <p className="mt-3 text-sm text-[#a9c8bf]/70">No tags have been created yet.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <button
                key={tag.id}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${selectedTagIds.includes(tag.id) ? 'border-transparent text-[#04120d]' : 'border-white/15 text-[#a9c8bf] hover:border-white/30 hover:text-[#f4fff8]'}`}
                style={selectedTagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                type="button"
                onClick={() => toggleTag(tag.id)}
              >
                <span
                  className="mr-2 inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        )}
      </section>
      {error && <p className="mt-10 text-[#ffaaa0]">{error}</p>}
      {!isLoading && !error && results.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-14 text-center">
          <SearchX className="mx-auto text-[#a9c8bf]" size={30} />
          <h2 className="mt-4 text-xl font-bold">Nothing matched your search</h2>
          <p className="mt-2 text-sm text-[#a9c8bf]">Try another keyword or clear a tag filter.</p>
        </div>
      )}
      {results.length > 0 && (
        <div
          className={
            viewMode === 'grid' ? 'mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'mt-8 space-y-3'
          }
        >
          {results.map((collection) => (
            <CollectionCard
              key={collection.id}
              viewMode={viewMode}
              collection={{
                ...collection,
                sourceCount: collection.sources.length,
                videoCount: collection.videoCount
              }}
              onPlay={(selectedCollection) => void playCollection(selectedCollection)}
              onEdit={(selectedCollection) =>
                navigate(`/home/collections/${selectedCollection.id}?edit=1`)
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
