import { Check, Clapperboard, ImagePlus, Loader2, Trash2, Upload } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import type { CollectionThumbnailImageInput } from '../../../shared/types/collection'

const maxCompressedThumbnailSizeBytes = 1024 * 1024
const thumbnailMimeType = 'image/webp'

export type ThumbnailPickerValue = {
  coverImage: CollectionThumbnailImageInput | null
  previewUrl: string | null
  removeCover: boolean
}

type PendingThumbnail = {
  input: CollectionThumbnailImageInput
  previewUrl: string
}

export type ThumbnailVideoOption = {
  id: string
  name: string
  url: string
  sizeBytes: number
}

type ThumbnailPickerProps = {
  value: ThumbnailPickerValue
  existingPreviewUrl?: string | null
  videoOptions?: ThumbnailVideoOption[]
  onChange: (value: ThumbnailPickerValue) => void
  onPendingChange?: (hasPendingThumbnail: boolean) => void
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`

  return `${bytes} B`
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    const objectUrl = URL.createObjectURL(file)

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Selected image could not be loaded.'))
    }
    image.src = objectUrl
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Thumbnail compression failed.'))
          return
        }

        resolve(blob)
      },
      thumbnailMimeType,
      quality
    )
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Compressed thumbnail could not be read.'))
    reader.readAsDataURL(blob)
  })
}

async function compressCanvas(
  canvas: HTMLCanvasElement,
  originalName: string,
  originalSizeBytes: number
): Promise<PendingThumbnail> {
  const qualities = [0.86, 0.76, 0.66, 0.56, 0.46]
  let smallestBlob: Blob | null = null

  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality)
    if (!smallestBlob || blob.size < smallestBlob.size) {
      smallestBlob = blob
    }
    if (blob.size <= maxCompressedThumbnailSizeBytes) {
      const previewUrl = await blobToDataUrl(blob)
      return {
        previewUrl,
        input: {
          dataUrl: previewUrl,
          originalName,
          originalSizeBytes,
          compressedSizeBytes: blob.size
        }
      }
    }
  }

  throw new Error(
    `Compressed image is ${smallestBlob ? formatBytes(smallestBlob.size) : 'too large'}. Maximum allowed size is 1 MB.`
  )
}

async function compressImageElement(file: File, image: HTMLImageElement): Promise<PendingThumbnail> {
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Image compression is unavailable.')
  const maxWidths = [1600, 1280, 960, 720]
  let lastError: unknown = null

  for (const maxWidth of maxWidths) {
    const scale = Math.min(1, maxWidth / image.naturalWidth)
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)

    try {
      return await compressCanvas(canvas, file.name, file.size)
    } catch (reason) {
      lastError = reason
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Image could not be compressed.')
}

export function ThumbnailPicker({
  value,
  existingPreviewUrl = null,
  videoOptions = [],
  onChange,
  onPendingChange
}: ThumbnailPickerProps): React.JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const frameVideoRef = useRef<HTMLVideoElement | null>(null)
  const [pendingThumbnail, setPendingThumbnail] = useState<PendingThumbnail | null>(null)
  const [isCompressing, setIsCompressing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [isFramePickerOpen, setIsFramePickerOpen] = useState(false)
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(videoOptions[0]?.id ?? null)
  const [frameTime, setFrameTime] = useState(0)
  const [frameDuration, setFrameDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const selectedVideo = useMemo(
    () => videoOptions.find((video) => video.id === selectedVideoId) ?? videoOptions[0] ?? null,
    [selectedVideoId, videoOptions]
  )
  const displayPreviewUrl =
    pendingThumbnail?.previewUrl ?? value.previewUrl ?? (value.removeCover ? null : existingPreviewUrl)
  const activeThumbnail = value.coverImage ?? pendingThumbnail?.input ?? null

  const chooseFile = async (file: File | null | undefined): Promise<void> => {
    if (!file) return

    try {
      setError(null)
      setIsCompressing(true)
      const image = await loadImageFromFile(file)
      const nextPendingThumbnail = await compressImageElement(file, image)
      setPendingThumbnail(nextPendingThumbnail)
      onPendingChange?.(true)
    } catch (reason) {
      setPendingThumbnail(null)
      onPendingChange?.(false)
      setError(reason instanceof Error ? reason.message : 'Thumbnail could not be compressed.')
    } finally {
      setIsCompressing(false)
    }
  }

  const captureVideoFrame = async (): Promise<void> => {
    const video = frameVideoRef.current
    if (!video || !selectedVideo) return

    try {
      setError(null)
      setIsCompressing(true)
      if (!video.videoWidth || !video.videoHeight) {
        throw new Error('Video frame is not ready yet.')
      }

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Video frame capture is unavailable.')
      const maxWidth = 1280
      const scale = Math.min(1, maxWidth / video.videoWidth)
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      context.drawImage(video, 0, 0, canvas.width, canvas.height)

      const nextPendingThumbnail = await compressCanvas(
        canvas,
        `${selectedVideo.name} frame`,
        selectedVideo.sizeBytes
      )
      setPendingThumbnail(nextPendingThumbnail)
      onPendingChange?.(true)
      setIsFramePickerOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Video frame could not be captured.')
    } finally {
      setIsCompressing(false)
    }
  }

  const approvePendingThumbnail = (): void => {
    if (!pendingThumbnail) return

    onChange({
      coverImage: pendingThumbnail.input,
      previewUrl: pendingThumbnail.previewUrl,
      removeCover: false
    })
    setPendingThumbnail(null)
    onPendingChange?.(false)
  }

  const deleteThumbnail = (): void => {
    setPendingThumbnail(null)
    onPendingChange?.(false)
    setError(null)
    onChange({ coverImage: null, previewUrl: null, removeCover: true })
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#0d0f12]/60 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold text-[#f4fff8]">Thumbnail</p>
          <p className="text-xs text-[#a9c8bf]">
            Any picture is accepted. The compressed result must be 1 MB or smaller.
          </p>
        </div>
        {displayPreviewUrl && (
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-bold text-[#ffaaa0] transition hover:bg-[#3e1c1f]/60"
            type="button"
            onClick={deleteThumbnail}
          >
            <Trash2 size={15} />
            Delete thumbnail
          </button>
        )}
      </div>

      <button
        className={`relative grid min-h-44 place-items-center overflow-hidden rounded-lg border border-dashed text-left transition ${
          isDragging
            ? 'border-[#00d982] bg-[#00b875]/15'
            : 'border-white/15 bg-white/[0.03] hover:border-[#00b875]/60 hover:bg-[#00b875]/10'
        }`}
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          void chooseFile(event.dataTransfer.files[0])
        }}
      >
        {displayPreviewUrl ? (
          <>
            <img className="h-full max-h-72 w-full object-cover" src={displayPreviewUrl} alt="" />
            {isCompressing && (
              <span className="absolute inset-0 grid place-items-center bg-black/65 text-[#f4fff8]">
                <span className="flex items-center gap-2 rounded-lg bg-[#111318]/90 px-3 py-2 text-sm font-bold">
                  <Loader2 className="animate-spin text-[#00d982]" size={18} />
                  Compressing thumbnail...
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="flex flex-col items-center gap-3 px-5 py-8 text-center text-[#a9c8bf]">
            {isCompressing ? (
              <Loader2 className="animate-spin text-[#00d982]" size={30} />
            ) : (
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-white/5 text-[#00d982]">
                <ImagePlus size={26} />
              </span>
            )}
            <span>
              <span className="block text-sm font-bold text-[#f4fff8]">
                {isCompressing ? 'Compressing thumbnail...' : 'Drop picture or click to select'}
              </span>
              <span className="mt-1 block text-xs">JPEG, PNG, WebP, or another image file.</span>
            </span>
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept="image/*"
        onChange={(event) => {
          void chooseFile(event.target.files?.[0])
          event.target.value = ''
        }}
      />

      {activeThumbnail && (
        <div className="grid gap-2 rounded-lg border border-white/10 bg-[#171a1f]/70 p-3 text-xs text-[#a9c8bf] sm:grid-cols-3">
          <span>
            <span className="block font-bold text-[#f4fff8]">Source</span>
            {formatBytes(activeThumbnail.originalSizeBytes)}
          </span>
          <span>
            <span className="block font-bold text-[#f4fff8]">After compression</span>
            {formatBytes(activeThumbnail.compressedSizeBytes)}
          </span>
          <span>
            <span className="block font-bold text-[#f4fff8]">Limit</span>1 MB
          </span>
        </div>
      )}

      {pendingThumbnail && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} />
            Change thumbnail
          </button>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-3 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982]"
            type="button"
            onClick={approvePendingThumbnail}
          >
            <Check size={16} />
            Approve
          </button>
        </div>
      )}

      {!pendingThumbnail && displayPreviewUrl && (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
            type="button"
            onClick={() => inputRef.current?.click()}
          >
            <Upload size={16} />
            Change thumbnail
          </button>
          {videoOptions.length > 0 && (
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
              type="button"
              onClick={() => setIsFramePickerOpen((current) => !current)}
            >
              <Clapperboard size={16} />
              Use video frame
            </button>
          )}
        </div>
      )}

      {!pendingThumbnail && !displayPreviewUrl && videoOptions.length > 0 && (
        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
            type="button"
            onClick={() => setIsFramePickerOpen((current) => !current)}
          >
            <Clapperboard size={16} />
            Use video frame
          </button>
        </div>
      )}

      {isFramePickerOpen && selectedVideo && (
        <div className="flex flex-col gap-3 rounded-lg border border-white/10 bg-[#171a1f]/70 p-3">
          {videoOptions.length > 1 && (
            <select
              className="w-full rounded-lg border border-white/15 bg-[#0d0f12] px-3 py-2 text-sm font-bold text-[#f4fff8] outline-none focus:border-[#00b875]"
              value={selectedVideo.id}
              onChange={(event) => {
                setSelectedVideoId(event.target.value)
                setFrameTime(0)
                setFrameDuration(0)
              }}
            >
              {videoOptions.map((video) => (
                <option key={video.id} value={video.id}>
                  {video.name}
                </option>
              ))}
            </select>
          )}
          <video
            key={selectedVideo.id}
            ref={frameVideoRef}
            className="max-h-64 w-full rounded-lg bg-black object-contain"
            src={selectedVideo.url}
            muted
            preload="metadata"
            onLoadedMetadata={(event) => {
              const video = event.currentTarget
              setFrameDuration(Number.isFinite(video.duration) ? video.duration : 0)
              setFrameTime(0)
            }}
            onSeeked={(event) => setFrameTime(event.currentTarget.currentTime)}
          />
          <input
            className="w-full"
            type="range"
            min={0}
            max={Math.max(frameDuration, 0)}
            step={0.1}
            value={frameTime}
            onChange={(event) => {
              const nextTime = Number(event.target.value)
              setFrameTime(nextTime)
              if (frameVideoRef.current) {
                frameVideoRef.current.currentTime = nextTime
              }
            }}
            disabled={frameDuration <= 0 || isCompressing}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#a9c8bf]">
            <span>{frameTime.toFixed(1)}s</span>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-3 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-50"
              type="button"
              onClick={() => void captureVideoFrame()}
              disabled={isCompressing}
            >
              {isCompressing ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
              Capture frame
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-xs text-[#ffaaa0]">{error}</p>}
    </section>
  )
}
