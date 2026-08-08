import {
  Folder,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  Play,
  Star,
  Trash2,
  Video
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { CollectionCardData, LibraryViewMode } from './types'
import { formatTagName } from '../tags/tagDisplay'
import placeholderThumbnail from '../../assets/placeholder.jpeg'

type CollectionCardProps = {
  collection: CollectionCardData
  viewMode: LibraryViewMode
  onOpen?: (collection: CollectionCardData) => void
  onPlay?: (collection: CollectionCardData) => void
  onEdit?: (collection: CollectionCardData) => void
  onRename?: (collection: CollectionCardData) => void
  onPin?: (collection: CollectionCardData) => void
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
  onDelete
}: CollectionCardProps): React.JSX.Element {
  const navigate = useNavigate()
  const cardRef = useRef<HTMLElement | null>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const isGrid = viewMode === 'grid'
  const thumbnailSrc = collection.coverPath ?? placeholderThumbnail
  const openCollection = (): void => {
    onOpen?.(collection) ?? navigate(`/home/collections/${collection.id}`)
  }

  useEffect(() => {
    if (!isMenuOpen) return

    const closeMenu = (): void => setIsMenuOpen(false)
    const handlePointerDown = (event: PointerEvent): void => {
      if (cardRef.current?.contains(event.target as Node)) return
      closeMenu()
    }
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeMenu()
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('blur', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    document.addEventListener('visibilitychange', closeMenu)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('blur', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      document.removeEventListener('visibilitychange', closeMenu)
    }
  }, [isMenuOpen])

  return (
    <article
      ref={cardRef}
      className={
        isGrid
          ? 'group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-[#00b875]/50 hover:bg-[#00b875]/[0.05]'
          : 'group relative flex items-center gap-4 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] transition hover:border-[#00b875]/50 hover:bg-[#00b875]/[0.05]'
      }
      role="button"
      tabIndex={0}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[data-collection-card-action="true"]')) return
        openCollection()
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        setIsMenuOpen(true)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openCollection()
        }
      }}
    >
      <div
        className={
          isGrid
            ? 'relative grid aspect-[16/10] w-full place-items-center overflow-hidden bg-[#00b875]/10'
            : 'relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#00b875]/10'
        }
      >
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={thumbnailSrc}
          alt=""
          aria-hidden="true"
        />
        <span className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/30 to-black/90" />
        <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-1 text-[14px] font-medium text-yellow-400 backdrop-blur-sm">
          <Star size={12} fill={collection.rating ? 'currentColor' : 'none'} />
          {collection.rating ?? 0}/10
        </span>
        {collection.isPinned && (
          <span className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-full bg-[#00b875] px-2 py-1 text-[10px] font-black text-[#04120d]">
            <Pin size={12} fill="currentColor" />
            PINNED
          </span>
        )}
        <span className="absolute inset-0 bg-black/0 transition group-hover:bg-black/15" />
        <div className="absolute right-3 bottom-3 left-3 flex flex-col gap-1">
          <h3 className="line-clamp-2 text-left text-base font-black leading-tight text-[#f4fff8] drop-shadow-[0_2px_12px_rgba(0,0,0,0.75)]">
            {collection.name}
          </h3>
        </div>
      </div>
      <div className={isGrid ? 'flex flex-col gap-1 p-4' : 'flex min-w-0 flex-1 flex-col gap-1'}>
        {collection.tags && collection.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {collection.tags.slice(0, 3).map((tag) => (
              <span
                key={tag.id}
                className="max-w-full truncate rounded-full border border-[#00b875]/40 px-2 py-1 text-[10px] font-bold text-nex-green"
              >
                {formatTagName(tag.name)}
              </span>
            ))}
            {collection.tags.length > 3 && (
              <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-bold text-[#a9c8bf]">
                +{collection.tags.length - 3}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 text-sm text-[#a9c8bf]">
          <div className="flex items-center gap-2">
            <Folder size={18} className="inline-block" /> {collection.sourceCount} -{' '}
            <Video size={18} className="inline-block" /> {collection.videoCount}
          </div>
          {collection.updatedLabel && (
            <p className="text-xs font-bold text-nex-muted">{collection.updatedLabel}</p>
          )}
        </div>
      </div>
      <div
        className={isGrid ? 'flex border-t border-white/[0.08]' : 'flex shrink-0'}
        data-collection-card-action="true"
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
