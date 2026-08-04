import { AlertTriangle, FileVideo, Pencil, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { MediaFile } from '../../../../shared/types/collection'
import type { LibraryViewMode } from './types'

type VideoCardProps = {
  media: MediaFile
  viewMode: LibraryViewMode
  onPlay: (media: MediaFile) => void
  onRename?: (media: MediaFile) => void
  onDelete?: (media: MediaFile) => void
  isSelected?: boolean
  isSelectable?: boolean
  onSelectChange?: (media: MediaFile, isSelected: boolean) => void
}

const videoCardThumbnailCache = new Map<string, string>()

const getVideoCardThumbnailKey = (media: MediaFile): string => media.filePath

export function VideoCard({
  media,
  viewMode,
  onPlay,
  onRename,
  onDelete,
  isSelected = false,
  isSelectable = false,
  onSelectChange
}: VideoCardProps): React.JSX.Element {
  const isGrid = viewMode === 'grid'
  const statusLabel = media.isMissing ? 'LOST' : media.isPending ? 'NEW' : null
  const thumbnailKey = getVideoCardThumbnailKey(media)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    () => videoCardThumbnailCache.get(thumbnailKey) ?? null
  )
  const [isThumbnailLoading, setIsThumbnailLoading] = useState(!thumbnailUrl && !media.isMissing)
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const thumbnailTargetTimeRef = useRef<number>(0)

  const captureThumbnail = (video: HTMLVideoElement): void => {
    if (thumbnailUrl || media.isMissing || !video.videoWidth || !video.videoHeight) return

    try {
      const canvas = thumbnailCanvasRef.current ?? document.createElement('canvas')
      thumbnailCanvasRef.current = canvas
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const context = canvas.getContext('2d')
      if (!context) return

      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const imageUrl = canvas.toDataURL('image/jpeg', 0.72)
      videoCardThumbnailCache.set(thumbnailKey, imageUrl)
      setThumbnailUrl(imageUrl)
    } catch {
      // Some OS-backed video URLs can block canvas extraction. In that case keep the stable icon.
    } finally {
      setIsThumbnailLoading(false)
    }
  }

  const runCardAction = (event: React.MouseEvent, action?: (media: MediaFile) => void): void => {
    event.stopPropagation()
    action?.(media)
  }

  const runPrimaryAction = (): void => {
    if (isSelectable) {
      onSelectChange?.(media, !isSelected)
      return
    }

    onPlay(media)
  }

  return (
    <article
      className={
        isGrid
          ? 'group relative overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.03] transition hover:border-[#00b875]/40 hover:bg-white/[0.055]'
          : 'group relative flex items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] p-2 transition hover:border-[#00b875]/40 hover:bg-white/[0.055]'
      }
      role="button"
      onClick={runPrimaryAction}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          runPrimaryAction()
        }
      }}
      aria-label={`${isSelectable ? 'Select' : 'Play'} ${media.filename}`}
    >
      {isSelectable && (
        <label
          className={
            isGrid
              ? 'absolute z-10 m-2 grid h-7 w-7 place-items-center rounded-md bg-black/60'
              : 'grid h-8 w-8 shrink-0 place-items-center rounded-md bg-black/25'
          }
          onClick={(event) => event.stopPropagation()}
        >
          <input
            className="h-4 w-4 accent-[#00b875]"
            type="checkbox"
            checked={isSelected}
            onChange={(event) => onSelectChange?.(media, event.target.checked)}
            aria-label={`Select ${media.filename}`}
          />
        </label>
      )}
      <div
        className={
          isGrid
            ? 'relative grid aspect-video w-full place-items-center overflow-hidden bg-[#050706] text-[#00d982]'
            : 'relative grid h-14 w-20 shrink-0 place-items-center overflow-hidden rounded-md bg-[#050706] text-[#00d982]'
        }
      >
        {thumbnailUrl && !media.isMissing && (
          <img className="h-full w-full object-cover" src={thumbnailUrl} alt="" />
        )}
        {!thumbnailUrl && !media.isMissing && (
          <>
            {isThumbnailLoading && (
              <span className="absolute inset-0 animate-pulse bg-white/[0.035]" />
            )}
            <video
              className="sr-only"
              src={media.url}
              preload="metadata"
              muted
              playsInline
              onLoadedMetadata={(event) => {
                const video = event.currentTarget
                if (!Number.isFinite(video.duration) || video.duration <= 0) {
                  setIsThumbnailLoading(false)
                  return
                }

                thumbnailTargetTimeRef.current = Math.min(
                  video.duration * 0.1,
                  Math.max(video.duration - 0.1, 0)
                )
                video.currentTime = thumbnailTargetTimeRef.current
              }}
              onSeeked={(event) => captureThumbnail(event.currentTarget)}
              onError={() => setIsThumbnailLoading(false)}
            />
          </>
        )}
        {!media.isMissing && !thumbnailUrl && (
          <span className="absolute text-[#f4fff8]/75">
            <FileVideo size={isGrid ? 28 : 20} />
          </span>
        )}
        {media.isMissing && <AlertTriangle size={isGrid ? 30 : 22} />}
      </div>
      <div className={isGrid ? 'p-3' : 'min-w-0 flex-1'}>
        <p className="truncate text-sm font-bold text-[#f4fff8]">{media.filename}</p>
        <p className="mt-0.5 truncate text-xs text-[#a9c8bf]">{media.filePath}</p>
        {statusLabel && (
          <span
            className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
              media.isMissing ? 'bg-[#ff6f60] text-[#220806]' : 'bg-[#00b875] text-[#04120d]'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <div
        className={
          isGrid
            ? 'flex border-t border-white/[0.08]'
            : 'flex shrink-0 overflow-hidden rounded-md border border-white/10'
        }
      >
        {onRename && (
          <button
            className={
              isGrid
                ? 'flex flex-1 items-center justify-center gap-2 py-2.5 text-xs font-bold text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                : 'grid h-9 w-9 place-items-center text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
            }
            type="button"
            onClick={(event) => runCardAction(event, onRename)}
            aria-label={`Rename ${media.filename}`}
          >
            <Pencil size={16} />
            {isGrid && 'Rename'}
          </button>
        )}
        {onDelete && (
          <button
            className={
              isGrid
                ? 'flex flex-1 items-center justify-center gap-2 border-l border-white/[0.08] py-2.5 text-xs font-bold text-[#ffaaa0] hover:bg-[#3e1c1f]/70'
                : 'grid h-9 w-9 place-items-center border-l border-white/10 text-[#ffaaa0] hover:bg-[#3e1c1f]/70'
            }
            type="button"
            onClick={(event) => runCardAction(event, onDelete)}
            aria-label={`Delete ${media.filename}`}
          >
            <Trash2 size={16} />
            {isGrid && 'Delete'}
          </button>
        )}
      </div>
    </article>
  )
}
