import { AlertTriangle, FileVideo, Pencil, Play } from 'lucide-react'
import { useRef, useState } from 'react'
import type { MediaFile } from '../../../../shared/types/collection'
import type { LibraryViewMode } from './types'

type VideoCardProps = {
  media: MediaFile
  viewMode: LibraryViewMode
  onPlay: (media: MediaFile) => void
  onRename?: (media: MediaFile) => void
}

const videoCardThumbnailCache = new Map<string, string>()

const getVideoCardThumbnailKey = (media: MediaFile): string => `${media.filePath}:${media.url}`

export function VideoCard({
  media,
  viewMode,
  onPlay,
  onRename
}: VideoCardProps): React.JSX.Element {
  const isGrid = viewMode === 'grid'
  const statusLabel = media.isMissing ? 'LOST' : media.isPending ? 'NEW' : null
  const thumbnailKey = getVideoCardThumbnailKey(media)
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(
    () => videoCardThumbnailCache.get(thumbnailKey) ?? null
  )
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)

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
    }
  }

  return (
    <article
      className={
        isGrid
          ? 'overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03]'
          : 'flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3'
      }
    >
      <button
        className={
          isGrid
            ? 'relative grid aspect-video w-full place-items-center overflow-hidden bg-[#00b875]/10 text-[#00d982]'
            : 'relative grid h-16 w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#00b875]/10 text-[#00d982]'
        }
        type="button"
        onClick={() => onPlay(media)}
        aria-label={`Play ${media.filename}`}
      >
        {thumbnailUrl && !media.isMissing && (
          <img className="h-full w-full object-cover" src={thumbnailUrl} alt="" />
        )}
        {!thumbnailUrl && !media.isMissing ? (
          <video
            className="sr-only"
            src={media.url}
            preload="metadata"
            muted
            playsInline
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              if (!Number.isFinite(video.duration) || video.duration <= 0) return

              video.currentTime = Math.min(video.duration * 0.1, Math.max(video.duration - 0.1, 0))
            }}
            onSeeked={(event) => captureThumbnail(event.currentTarget)}
            onLoadedData={(event) => captureThumbnail(event.currentTarget)}
          />
        ) : (
          media.isMissing && <AlertTriangle size={isGrid ? 32 : 23} />
        )}
        {!media.isMissing && (
          <span className="absolute text-[#f4fff8]/80">
            <FileVideo size={isGrid ? 30 : 22} />
          </span>
        )}
      </button>
      <div className={isGrid ? 'p-4' : 'min-w-0 flex-1'}>
        <button
          className="block max-w-full truncate text-left font-bold text-[#f4fff8]"
          type="button"
          onClick={() => onPlay(media)}
        >
          {media.filename}
        </button>
        <p className="mt-1 truncate text-sm text-[#a9c8bf]">{media.filePath}</p>
        {statusLabel && (
          <span
            className={`mt-3 inline-block rounded-full px-2 py-0.5 text-[10px] font-black ${
              media.isMissing ? 'bg-[#ff6f60] text-[#220806]' : 'bg-[#00b875] text-[#04120d]'
            }`}
          >
            {statusLabel}
          </span>
        )}
      </div>
      <div className={isGrid ? 'flex border-t border-white/[0.08]' : 'flex shrink-0 gap-1'}>
        <button
          className={
            isGrid
              ? 'flex flex-1 items-center justify-center gap-2 py-3 text-sm font-bold text-[#a9c8bf] hover:bg-white/5 hover:text-[#00d982]'
              : 'grid h-9 w-9 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#00d982]'
          }
          type="button"
          onClick={() => onPlay(media)}
          aria-label={`Play ${media.filename}`}
        >
          <Play size={16} fill="currentColor" />
          {isGrid && 'Play'}
        </button>
        {onRename && (
          <button
            className={
              isGrid
                ? 'grid w-12 place-items-center border-l border-white/[0.08] text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                : 'grid h-9 w-9 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
            }
            type="button"
            onClick={() => onRename(media)}
            aria-label={`Rename ${media.filename}`}
          >
            <Pencil size={17} />
          </button>
        )}
      </div>
    </article>
  )
}
