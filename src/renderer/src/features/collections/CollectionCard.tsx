import { FolderOpen, MoreHorizontal, Pencil, Pin, Play, Star, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionCardData, LibraryViewMode } from './types'

type CollectionCardProps = {
  collection: CollectionCardData
  viewMode: LibraryViewMode
  onOpen?: (collection: CollectionCardData) => void
  onPlay?: (collection: CollectionCardData) => void
  onEdit?: (collection: CollectionCardData) => void
  onRename?: (collection: CollectionCardData) => void
  onPin?: (collection: CollectionCardData) => void
  onRate?: (collection: CollectionCardData, rating: number) => void
  onDelete?: (collection: CollectionCardData) => void
}

export function CollectionCard({
  collection,
  viewMode,
  onOpen,
  onPlay,
  onEdit,
  onRename,
  onPin,
  onRate,
  onDelete
}: CollectionCardProps): React.JSX.Element {
  const navigate = useNavigate()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isGrid = viewMode === 'grid'
  const cover = collection.coverPath ? `url(${JSON.stringify(collection.coverPath)})` : undefined
  const openCollection = (): void => {
    onOpen?.(collection) ?? navigate(`/home/collections/${collection.id}`)
  }

  return (
    <article
      className={
        isGrid
          ? 'group relative overflow-visible rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-[#00b875]/50 hover:bg-[#00b875]/[0.05]'
          : 'group relative flex items-center gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3 transition hover:border-[#00b875]/50 hover:bg-[#00b875]/[0.05]'
      }
    >
      <button
        className={
          isGrid
            ? 'relative grid aspect-[16/10] w-full place-items-center overflow-hidden bg-[#00b875]/10'
            : 'relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#00b875]/10'
        }
        type="button"
        aria-label={`Open ${collection.name}`}
        onClick={openCollection}
        onContextMenu={(event) => event.stopPropagation()}
        style={
          cover
            ? { backgroundImage: cover, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        {!cover && <FolderOpen className="text-[#00d982]" size={isGrid ? 34 : 24} />}
        {collection.isPinned && (
          <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-[#00b875] px-2 py-1 text-[10px] font-black text-[#04120d]">
            <Pin size={12} fill="currentColor" />
            PINNED
          </span>
        )}
        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
      </button>
      <div className={isGrid ? 'flex flex-col gap-1 p-4' : 'flex min-w-0 flex-1 flex-col gap-1'}>
        <button
          className="block max-w-full truncate text-left font-bold text-[#f4fff8]"
          type="button"
          onClick={openCollection}
          onContextMenu={(event) => event.stopPropagation()}
        >
          {collection.name}
        </button>
        <p className="text-sm text-[#a9c8bf]">
          {collection.sourceCount} {collection.sourceCount === 1 ? 'folder' : 'folders'} -{' '}
          {collection.videoCount} {collection.videoCount === 1 ? 'video' : 'videos'}
        </p>
        <p className="flex items-center gap-1 text-xs text-[#a9c8bf]/80">
          <Star size={13} fill={collection.rating ? 'currentColor' : 'none'} />
          {collection.rating ?? 0}/10
        </p>
        {collection.updatedLabel && (
          <p className="text-xs text-[#a9c8bf]/65">{collection.updatedLabel}</p>
        )}
      </div>
      <div
        className={isGrid ? 'flex border-t border-white/[0.08]' : 'flex shrink-0'}
        data-collection-card-action="true"
        onContextMenu={(event) => event.stopPropagation()}
      >
        <button
          className={
            isGrid
              ? 'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#00d982]'
              : 'grid h-9 w-9 place-items-center rounded-md text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#00d982]'
          }
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onPlay?.(collection)
          }}
          onContextMenu={(event) => event.stopPropagation()}
          aria-label={`Play ${collection.name}`}
        >
          <Play size={isGrid ? 16 : 17} fill="currentColor" />
          {isGrid && 'Play'}
        </button>
        <button
          className={
            isGrid
              ? 'grid w-12 place-items-center border-l border-white/[0.08] text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]'
              : 'grid h-9 w-9 place-items-center rounded-md text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]'
          }
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setIsMenuOpen((current) => !current)
          }}
          onContextMenu={(event) => event.stopPropagation()}
          aria-label={`More options for ${collection.name}`}
        >
          <MoreHorizontal size={20} />
        </button>
      </div>
      {isMenuOpen && (
        <div
          className="absolute right-2 bottom-11 z-20 w-40 overflow-hidden rounded-lg border border-white/10 bg-[#171a1f] py-1 text-sm shadow-[0_16px_48px_rgba(0,0,0,0.38)]"
          data-collection-card-action="true"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.stopPropagation()}
        >
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#f4fff8] hover:bg-white/[0.07]"
            type="button"
            onClick={() => {
              setIsMenuOpen(false)
              openCollection()
            }}
          >
            <FolderOpen size={16} />
            Open
          </button>
          <button
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#f4fff8] hover:bg-white/[0.07]"
            type="button"
            onClick={() => {
              setIsMenuOpen(false)
              onEdit?.(collection) ?? navigate(`/home/collections/${collection.id}?edit=1`)
            }}
          >
            <Pencil size={16} />
            Edit
          </button>
          {onRename && (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#f4fff8] hover:bg-white/[0.07]"
              type="button"
              onClick={() => {
                setIsMenuOpen(false)
                onRename(collection)
              }}
            >
              <Pencil size={16} />
              Rename
            </button>
          )}
          {onPin && (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#f4fff8] hover:bg-white/[0.07]"
              type="button"
              onClick={() => {
                setIsMenuOpen(false)
                onPin(collection)
              }}
            >
              <Pin size={16} />
              {collection.isPinned ? 'Unpin' : 'Pin'}
            </button>
          )}
          {onRate && (
            <div className="flex flex-col gap-2 border-t border-white/10 px-3 py-2">
              <p className="text-xs font-semibold text-[#a9c8bf]">Rating</p>
              <div className="flex gap-1">
                {Array.from({ length: 11 }, (_, rating) => rating).map((rating) => (
                  <button
                    key={rating}
                    className={`grid h-6 w-6 place-items-center rounded text-xs font-bold ${
                      (collection.rating ?? 0) === rating
                        ? 'bg-[#00b875] text-[#04120d]'
                        : 'bg-white/[0.06] text-[#a9c8bf] hover:bg-white/[0.12]'
                    }`}
                    type="button"
                    onClick={() => {
                      setIsMenuOpen(false)
                      onRate(collection, rating)
                    }}
                    aria-label={`Rate ${collection.name} ${rating}`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>
          )}
          {onDelete && (
            <button
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[#ffaaa0] hover:bg-[#3e1c1f]/70"
              type="button"
              onClick={() => {
                setIsMenuOpen(false)
                onDelete(collection)
              }}
            >
              <Trash2 size={16} />
              Delete
            </button>
          )}
        </div>
      )}
    </article>
  )
}
