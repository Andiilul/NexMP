import { AlertTriangle, Folder, Pencil } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { CollectionSource } from '../../../../shared/types/collection'
import type { LibraryViewMode } from './types'

type SourceCardProps = {
  source: CollectionSource
  viewMode: LibraryViewMode
  videoCount: number
  collectionId?: string
  onOpen?: (source: CollectionSource) => void
  onRename?: (source: CollectionSource) => void
}

export function SourceCard({
  source,
  viewMode,
  videoCount,
  collectionId,
  onOpen,
  onRename
}: SourceCardProps): React.JSX.Element {
  const navigate = useNavigate()
  const isGrid = viewMode === 'grid'

  const openSource = (): void => {
    if (onOpen) {
      onOpen(source)
      return
    }

    if (collectionId) navigate(`/home/collections/${collectionId}/sources/${source.id}`)
  }

  return (
    <article
      className={
        isGrid
          ? 'overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-[#00b875]/50 hover:bg-[#00b875]/[0.05]'
          : 'flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-[#00b875]/50 hover:bg-[#00b875]/[0.05]'
      }
    >
      <button
        className={
          isGrid
            ? 'grid aspect-[16/10] w-full place-items-center bg-[#00b875]/10 text-[#00d982]'
            : 'grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-[#00b875]/10 text-[#00d982]'
        }
        type="button"
        onClick={openSource}
        aria-label={`Open ${source.name}`}
      >
        {source.isMissing ? (
          <AlertTriangle className="text-[#ffb36a]" size={isGrid ? 34 : 24} />
        ) : (
          <Folder size={isGrid ? 34 : 24} />
        )}
      </button>
      <div className={isGrid ? 'flex flex-col gap-1 p-4' : 'flex min-w-0 flex-1 flex-col gap-1'}>
        <button
          className="block max-w-full truncate text-left font-bold text-[#f4fff8]"
          type="button"
          onClick={openSource}
        >
          {source.name}
        </button>
        <p className="truncate text-sm text-[#a9c8bf]">{source.sourcePath}</p>
        <p className="text-xs text-[#a9c8bf]/70">
          {source.isMissing
            ? `Folder unavailable - ${source.isDynamic ? 'dynamic' : 'manual'}`
            : `${videoCount} ${videoCount === 1 ? 'video' : 'videos'} - ${
                source.isDynamic ? 'dynamic' : 'manual'
              }`}
        </p>
      </div>
      {onRename && (
        <div className={isGrid ? 'border-t border-white/[0.08]' : 'shrink-0'}>
          <button
            className={
              isGrid
                ? 'flex w-full items-center justify-center gap-2 py-3 text-sm font-bold text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                : 'grid h-9 w-9 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
            }
            type="button"
            onClick={() => onRename(source)}
            aria-label={`Rename ${source.name}`}
          >
            <Pencil size={17} />
            {isGrid && 'Rename'}
          </button>
        </div>
      )}
    </article>
  )
}
