import { Grid2X2, List, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionWithSources } from '../../../../shared/types/collection'
import { CollectionCard } from './CollectionCard'
import type { LibraryViewMode } from './types'

export function CollectionsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [collections, setCollections] = useState<CollectionWithSources[]>([])
  const [viewMode, setViewMode] = useState<LibraryViewMode>('grid')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return
    }

    void window.api?.collections
      .list(profileId)
      .then(setCollections)
      .catch(() => setError('Unable to load collections.'))
      .finally(() => setIsLoading(false))
  }, [navigate])

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#00d982]">YOUR LIBRARY</p>
          <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
          <p className="mt-2 text-[#a9c8bf]">Organize your video folders in one place.</p>
        </div>
        <div className="flex items-center gap-3">
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
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2.5 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982]"
            type="button"
            onClick={() => navigate('/home/collections/new')}
          >
            <Plus size={18} />
            Add Collection
          </button>
        </div>
      </div>
      {isLoading && <p className="mt-12 text-[#a9c8bf]">Loading collections...</p>}
      {error && <p className="mt-12 text-[#ffaaa0]">{error}</p>}
      {!isLoading && !error && collections.length === 0 && (
        <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center">
          <h2 className="text-xl font-bold">No collections yet</h2>
          <p className="mt-2 text-sm text-[#a9c8bf]">
            Create a collection now. You can add sources later.
          </p>
          <button
            className="mt-6 rounded-lg bg-[#00b875] px-5 py-2.5 font-bold text-[#04120d]"
            type="button"
            onClick={() => navigate('/home/collections/new')}
          >
            Create Collection
          </button>
        </div>
      )}
      {collections.length > 0 && (
        <div
          className={
            viewMode === 'grid' ? 'mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4' : 'mt-8 space-y-3'
          }
        >
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              viewMode={viewMode}
              collection={{
                ...collection,
                sourceCount: collection.sources.length,
                videoCount: 0,
                updatedLabel: 'Recently created'
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
