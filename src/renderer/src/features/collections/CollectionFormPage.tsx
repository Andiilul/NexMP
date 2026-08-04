import { ArrowLeft, FolderOpen, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { SourceMediaPreview, Tag } from '../../../../shared/types/collection'

type SourceDraft = {
  sourcePath: string
  preview: SourceMediaPreview[]
  selectedFilePaths: string[]
}

export function CollectionFormPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<Tag[]>([])
  const [tagIds, setTagIds] = useState<string[]>([])
  const [newTagName, setNewTagName] = useState('')
  const [sourceDynamic, setSourceDynamic] = useState(true)
  const [sources, setSources] = useState<SourceDraft[]>([])
  const [reviewSourcePath, setReviewSourcePath] = useState<string | null>(null)

  useEffect(() => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) return
    void window.api?.collections.listTags(profileId).then((nextTags) => setTags(nextTags ?? []))
  }, [])

  const addTag = async (): Promise<void> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId || !newTagName.trim()) return
    const tag = await window.api?.collections.createTag(profileId, newTagName, '#00b875')
    if (!tag) return
    setTags((current) => [...current, tag])
    setTagIds((current) => [...current, tag.id])
    setNewTagName('')
  }

  const previewStaticSource = async (sourcePath: string): Promise<SourceDraft> => {
    const preview = await window.api?.collections.previewSourceMedia(sourcePath)

    return {
      sourcePath,
      preview: preview ?? [],
      selectedFilePaths: (preview ?? []).map((media) => media.filePath)
    }
  }

  const chooseSourceFolders = async (): Promise<void> => {
    try {
      setError(null)
      const selectedPaths = await window.api?.collections.selectSourceFolders()
      if (!selectedPaths || selectedPaths.length === 0) return
      const existingPaths = new Set(sources.map((source) => source.sourcePath))
      const nextPaths = selectedPaths.filter((sourcePath) => !existingPaths.has(sourcePath))
      const nextSources = sourceDynamic
        ? nextPaths.map((sourcePath) => ({ sourcePath, preview: [], selectedFilePaths: [] }))
        : await Promise.all(nextPaths.map((sourcePath) => previewStaticSource(sourcePath)))
      setSources((current) => [...current, ...nextSources])
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to select source folders.')
    }
  }

  const changeSourceMode = async (isDynamic: boolean): Promise<void> => {
    setSourceDynamic(isDynamic)
    if (isDynamic) return

    try {
      setError(null)
      const missingPreviewSources = sources.filter((source) => source.preview.length === 0)
      const previewedSources = await Promise.all(
        missingPreviewSources.map((source) => previewStaticSource(source.sourcePath))
      )
      setSources((current) =>
        current.map(
          (source) =>
            previewedSources.find((previewed) => previewed.sourcePath === source.sourcePath) ??
            source
        )
      )
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to preview source files.')
    }
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return
    }

    try {
      setIsCreating(true)
      setError(null)
      const collectionApi = window.api?.collections
      if (!collectionApi)
        throw new Error('Collection service is unavailable. Please restart NexMP.')

      await collectionApi.create({
        profileId,
        name,
        sourcePaths: sources.map((source) => source.sourcePath),
        sourceDynamic,
        tagIds,
        sources: sources.map((source) => ({
          sourcePath: source.sourcePath,
          isDynamic: sourceDynamic,
          includedFilePaths: sourceDynamic ? undefined : source.selectedFilePaths
        }))
      })
      navigate('/home')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create collection.')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] transition hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate('/home')}
      >
        <ArrowLeft size={17} />
        Back to Home
      </button>
      <div className="mt-7 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7">
        <h1 className="text-2xl font-bold">Create Collection</h1>
        <p className="mt-2 text-sm text-[#a9c8bf]">
          Start with a name. Sources can be added whenever you are ready.
        </p>
        <form className="mt-8" onSubmit={(event) => void submit(event)}>
          <label className="block text-sm font-semibold" htmlFor="collection-name">
            Collection name
          </label>
          <input
            id="collection-name"
            className="mt-2 w-full rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-[#f4fff8] outline-none placeholder:text-white/35 focus:border-[#00b875]"
            placeholder="e.g. Anime"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoFocus
          />
          <div className="mt-7">
            <p className="text-sm font-semibold">
              Sources <span className="font-normal text-[#a9c8bf]">(optional)</span>
            </p>
            {sources.length === 0 ? (
              <div className="mt-2 flex items-center gap-3 rounded-xl border border-dashed border-white/15 bg-[#0d0f12]/45 p-4 text-[#a9c8bf]">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-white/5">
                  <FolderOpen size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[#f4fff8]">No source folders yet</p>
                  <p className="mt-0.5 text-xs">Choose one or more folders to scan for videos.</p>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-3 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982]"
                  type="button"
                  onClick={() => void chooseSourceFolders()}
                >
                  <Plus size={16} />
                  Add
                </button>
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {sources.map((source) => (
                  <div
                    key={source.sourcePath}
                    className="flex items-center gap-3 rounded-lg border border-white/10 bg-[#0d0f12]/60 px-3 py-2.5"
                  >
                    <FolderOpen className="shrink-0 text-[#00d982]" size={18} />
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-[#a9c8bf]">
                        {source.sourcePath}
                      </span>
                      {!sourceDynamic && (
                        <span className="mt-0.5 block text-xs text-[#a9c8bf]/65">
                          {source.selectedFilePaths.length} of {source.preview.length} videos
                          included
                        </span>
                      )}
                    </div>
                    {!sourceDynamic && (
                      <button
                        className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-semibold text-[#f4fff8] hover:bg-white/5"
                        type="button"
                        onClick={() => setReviewSourcePath(source.sourcePath)}
                      >
                        Review
                      </button>
                    )}
                    <button
                      className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#ffaaa0]"
                      type="button"
                      onClick={() =>
                        setSources((current) =>
                          current.filter((item) => item.sourcePath !== source.sourcePath)
                        )
                      }
                      aria-label={`Remove ${source.sourcePath}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-semibold text-[#f4fff8] transition hover:bg-white/5"
                  type="button"
                  onClick={() => void chooseSourceFolders()}
                >
                  <Plus size={16} />
                  Add another folder
                </button>
              </div>
            )}
            <label className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-[#f4fff8]">Dynamic source</span>
                <span className="mt-0.5 block text-xs text-[#a9c8bf]">
                  Existing videos are imported now. Future rescans show new files for confirmation.
                </span>
              </span>
              <input
                className="h-5 w-5 accent-[#00b875]"
                type="checkbox"
                checked={sourceDynamic}
                onChange={(event) => void changeSourceMode(event.target.checked)}
              />
            </label>
          </div>
          <div className="mt-7">
            <p className="text-sm font-semibold">
              Tags <span className="font-normal text-[#a9c8bf]">(optional)</span>
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`rounded-full border px-3 py-1.5 text-sm ${tagIds.includes(tag.id) ? 'text-[#04120d]' : 'border-white/15 text-[#a9c8bf]'}`}
                  style={tagIds.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                  type="button"
                  onClick={() =>
                    setTagIds((current) =>
                      current.includes(tag.id)
                        ? current.filter((id) => id !== tag.id)
                        : [...current, tag.id]
                    )
                  }
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0d0f12] px-3 py-2 text-sm outline-none focus:border-[#00b875]"
                placeholder="Create a new tag"
                value={newTagName}
                onChange={(event) => setNewTagName(event.target.value)}
              />
              <button
                className="rounded-lg border border-white/15 px-3 text-sm font-semibold hover:bg-white/5"
                type="button"
                onClick={() => void addTag()}
                disabled={!newTagName.trim()}
              >
                Add tag
              </button>
            </div>
          </div>
          {error && <p className="mt-5 text-sm text-[#ffaaa0]">{error}</p>}
          <div className="mt-8 flex justify-end gap-3">
            <button
              className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
              type="button"
              onClick={() => navigate('/home')}
              disabled={isCreating}
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-[#00b875] px-5 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-50"
              type="submit"
              disabled={!name.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Collection'}
            </button>
          </div>
        </form>
      </div>
      {reviewSourcePath && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
          <div className="flex max-h-[82vh] w-full max-w-2xl flex-col rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)]">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Include videos</h2>
                <p className="mt-1 truncate text-sm text-[#a9c8bf]">{reviewSourcePath}</p>
              </div>
              <button
                className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={() => setReviewSourcePath(null)}
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5 min-h-0 overflow-y-auto rounded-lg border border-white/10">
              {sources
                .find((source) => source.sourcePath === reviewSourcePath)
                ?.preview.map((media) => {
                  const source = sources.find((item) => item.sourcePath === reviewSourcePath)
                  const checked = source?.selectedFilePaths.includes(media.filePath) ?? false

                  return (
                    <label
                      key={media.filePath}
                      className="flex items-center gap-3 border-b border-white/[0.06] px-3 py-2.5 last:border-b-0"
                    >
                      <input
                        className="h-4 w-4 accent-[#00b875]"
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setSources((current) =>
                            current.map((item) => {
                              if (item.sourcePath !== reviewSourcePath) return item
                              const selectedFilePaths = event.target.checked
                                ? [...new Set([...item.selectedFilePaths, media.filePath])]
                                : item.selectedFilePaths.filter((path) => path !== media.filePath)
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
                  )
                })}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d]"
                type="button"
                onClick={() => setReviewSourcePath(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
