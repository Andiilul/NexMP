import { ArrowLeft, ArrowDownAZ, BarChart3, Plus, Tags, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionSearchResult, Tag } from '../../../../shared/types/collection'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/useToast'
import { formatTagName } from './tagDisplay'

type TagWithCount = Tag & { collectionCount: number }
type TagSortBy = 'name' | 'count'

const TAG_COLOR_PRESETS = ['#00b875', '#00a6ff', '#ffb020', '#ff6f60', '#b56cff', '#38d9a9']

function compareTagName(firstTag: Tag, secondTag: Tag): number {
  return formatTagName(firstTag.name).localeCompare(formatTagName(secondTag.name), undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

export function TagsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { success, warning } = useToast()
  const [tags, setTags] = useState<Tag[]>([])
  const [collections, setCollections] = useState<CollectionSearchResult[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PRESETS[0])
  const [sortBy, setSortBy] = useState<TagSortBy>('name')
  const [deleteTag, setDeleteTag] = useState<TagWithCount | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadTags = useCallback(async (): Promise<void> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return
    }

    const collectionApi = window.api?.collections
    if (!collectionApi) throw new Error('Collection service is unavailable. Please restart NexMP.')

    const [nextTags, nextCollections] = await Promise.all([
      collectionApi.listTags(profileId),
      collectionApi.search(profileId, '', [])
    ])
    setTags(nextTags ?? [])
    setCollections(nextCollections ?? [])
  }, [navigate])

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        setError(null)
        await loadTags()
      } catch (reason) {
        if (!isMounted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load tags.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [loadTags])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    collections.forEach((collection) => {
      collection.tags.forEach((tag) => counts.set(tag.id, (counts.get(tag.id) ?? 0) + 1))
    })
    return counts
  }, [collections])

  const tagsWithCount = useMemo<TagWithCount[]>(
    () =>
      tags.map((tag) => ({
        ...tag,
        collectionCount: tagCounts.get(tag.id) ?? 0
      })),
    [tagCounts, tags]
  )

  const sortedTags = useMemo(
    () =>
      [...tagsWithCount].sort((firstTag, secondTag) => {
        if (sortBy === 'count') {
          return (
            secondTag.collectionCount - firstTag.collectionCount ||
            compareTagName(firstTag, secondTag)
          )
        }

        return compareTagName(firstTag, secondTag)
      }),
    [sortBy, tagsWithCount]
  )

  const createTag = async (): Promise<void> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId || !newTagName.trim()) return

    try {
      setIsSaving(true)
      setError(null)
      await window.api?.collections.createTag(profileId, newTagName, newTagColor)
      setNewTagName('')
      success('Tag created.')
      await loadTags()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to create tag.'
      setError(message)
      warning(message)
    } finally {
      setIsSaving(false)
    }
  }

  const confirmDeleteTag = async (): Promise<void> => {
    if (!deleteTag) return

    try {
      setIsSaving(true)
      setError(null)
      await window.api?.collections.deleteTag(deleteTag.id)
      success('Tag deleted.')
      setDeleteTag(null)
      await loadTags()
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete tag.'
      setError(message)
      warning(message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] transition hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate('/home')}
      >
        <ArrowLeft size={17} />
        Back to Home
      </button>

      <div className="mt-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-2 text-sm font-semibold text-[#00d982]">TAGS</p>
          <h1 className="text-3xl font-bold tracking-tight">Manage tags</h1>
          <p className="mt-2 text-[#a9c8bf]">
            Create tags, delete unused ones, or click a tag to filter Home.
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#a9c8bf]">
          {tagsWithCount.length} tag{tagsWithCount.length === 1 ? '' : 's'}
        </div>
      </div>

      <section className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <h2 className="font-bold">Add tag</h2>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            className="min-w-64 flex-1 rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-sm text-[#f4fff8] outline-none placeholder:text-white/35 focus:border-[#00b875]"
            placeholder="e.g. Action, Horror, When Yhhh :v"
            value={newTagName}
            onChange={(event) => setNewTagName(event.target.value)}
            maxLength={40}
          />
          <input
            className="h-11 w-14 rounded-lg border border-white/15 bg-[#0d0f12] p-1"
            type="color"
            value={newTagColor}
            onChange={(event) => setNewTagColor(event.target.value)}
            aria-label="Tag color"
          />
          <div className="flex flex-wrap gap-2">
            {TAG_COLOR_PRESETS.map((color) => (
              <button
                key={color}
                className={`h-8 w-8 rounded-full border-2 transition ${
                  newTagColor === color ? 'border-white' : 'border-transparent'
                }`}
                style={{ backgroundColor: color }}
                type="button"
                onClick={() => setNewTagColor(color)}
                aria-label={`Use ${color}`}
              />
            ))}
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-3 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
            type="button"
            onClick={() => void createTag()}
            disabled={!newTagName.trim() || isSaving}
          >
            <Plus size={17} />
            Add Tag
          </button>
        </div>
      </section>

      {error && <p className="mt-6 text-sm text-[#ffaaa0]">{error}</p>}

      {isLoading ? (
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-28 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]"
            />
          ))}
        </div>
      ) : tagsWithCount.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-14 text-center">
          <Tags className="mx-auto text-[#a9c8bf]" size={32} />
          <h2 className="mt-4 text-xl font-bold">No tags yet</h2>
          <p className="mt-2 text-sm text-[#a9c8bf]">
            Add your first tag, then assign it when creating or editing collections.
          </p>
        </section>
      ) : (
        <section className="mt-8">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">All tags</h2>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-[#a9c8bf]">Sort by</span>
              {[
                { value: 'name' as const, label: 'Name', icon: ArrowDownAZ },
                { value: 'count' as const, label: 'Count', icon: BarChart3 }
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {sortedTags.map((tag) => (
              <article
                key={tag.id}
                className="cursor-pointer rounded-xl border border-white/10 bg-[#171a1f] p-4 transition hover:border-[#00b875]/50 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d982]"
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/home?tags=${tag.id}`)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  navigate(`/home?tags=${tag.id}`)
                }}
              >
                <div className="flex w-full items-center gap-3 text-left">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-black text-[#04120d]"
                    style={{ backgroundColor: tag.color }}
                  >
                    #
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold">
                      {formatTagName(tag.name)}
                    </span>
                    <span className="mt-1 block text-sm text-[#a9c8bf]">
                      {tag.collectionCount} Collection
                    </span>
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-end gap-3 border-t border-white/[0.07] pt-3">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[#ffaaa0] transition hover:bg-[#3e1c1f]/70"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation()
                      setDeleteTag(tag)
                    }}
                  >
                    <Trash2 size={15} />
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <Modal
        isOpen={deleteTag !== null}
        title="Delete tag"
        onClose={() => setDeleteTag(null)}
        closeLabel="Close delete tag modal"
      >
        {deleteTag && (
          <>
            <div className="mt-5 rounded-lg border border-white/10 bg-[#0d0f12]/70 p-4">
              <p className="font-bold">{formatTagName(deleteTag.name)}</p>
              <p className="mt-1 text-sm text-[#a9c8bf]">
                Used by {deleteTag.collectionCount} collection. Deleting it will remove this tag
                from those collections.
              </p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
                type="button"
                onClick={() => setDeleteTag(null)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#160a0c] disabled:opacity-60"
                type="button"
                onClick={() => void confirmDeleteTag()}
                disabled={isSaving}
              >
                Delete Tag
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
