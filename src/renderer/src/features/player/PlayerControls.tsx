import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import {
  Captions,
  Keyboard,
  List,
  Maximize,
  Pause,
  Play,
  Ratio,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX
} from 'lucide-react'
import type { VideoFile } from '../../../../shared/types/media'
import { Tooltip } from '../../components/Tooltip'
import { formatTime } from './time'

type PlayerControlsProps = {
  videoFile: VideoFile
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  volume: number
  aspectRatioLabel: string
  subtitlesEnabled: boolean
  subtitleTrackCount: number
  activeSubtitleLabel?: string | null
  canPlayPrevious: boolean
  canPlayNext: boolean
  onChangeVolume: (volume: number) => void
  onControlsEnter: () => void
  onControlsLeave: () => void
  onSeek: (seconds: number) => void
  onCycleAspectRatio: () => void
  onToggleSubtitles: () => void
  onPlayPrevious: () => void
  onPlayNext: () => void
  onOpenHotkeys: () => void
  onTogglePlaylist: () => void
  onToggleFullscreen: () => void
  onToggleMute: () => void
  onTogglePlay: () => void
}

type TimelinePreviewState = {
  isVisible: boolean
  time: number
  percent: number
  imageUrl: string | null
  isLoading: boolean
}

const thumbnailIntervalSeconds = 10
const thumbnailPreviewWidth = 168
const thumbnailPreviewQuality = 0.72
const thumbnailWarmupDelayMs = 250
const iconButtonClass = 'group grid h-[38px] w-[38px] place-items-center rounded-md text-white'
const playlistButtonClass = `${iconButtonClass} disabled:cursor-not-allowed disabled:opacity-35`

function getNearestThumbnailTime(time: number, duration: number): number {
  const safeDuration = Math.max(duration - 0.05, 0)
  const nearestTime = Math.round(time / thumbnailIntervalSeconds) * thumbnailIntervalSeconds

  return Math.min(Math.max(nearestTime, 0), safeDuration)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

export function PlayerControls({
  videoFile,
  isPlaying,
  isMuted,
  currentTime,
  duration,
  volume,
  aspectRatioLabel,
  subtitlesEnabled,
  subtitleTrackCount,
  activeSubtitleLabel,
  canPlayPrevious,
  canPlayNext,
  onChangeVolume,
  onCycleAspectRatio,
  onToggleSubtitles,
  onControlsEnter,
  onControlsLeave,
  onOpenHotkeys,
  onPlayNext,
  onPlayPrevious,
  onSeek,
  onTogglePlaylist,
  onToggleFullscreen,
  onToggleMute,
  onTogglePlay
}: PlayerControlsProps): React.JSX.Element {
  const videoUrl = videoFile.url
  const thumbnailVideoRef = useRef<HTMLVideoElement | null>(null)
  const thumbnailCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const thumbnailCacheVideoRef = useRef<HTMLVideoElement | null>(null)
  const thumbnailCacheCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const thumbnailCacheRef = useRef<Map<number, string>>(new Map())
  const thumbnailCacheGenerationRef = useRef(0)
  const thumbnailTimerRef = useRef<number | null>(null)
  const thumbnailRequestRef = useRef(0)
  const [timelinePreview, setTimelinePreview] = useState<TimelinePreviewState>({
    isVisible: false,
    time: 0,
    percent: 0,
    imageUrl: null,
    isLoading: false
  })

  const captureThumbnail = useCallback(
    (thumbnailVideo: HTMLVideoElement, thumbnailCanvas: HTMLCanvasElement): string | null => {
      if (!thumbnailVideo.videoWidth || !thumbnailVideo.videoHeight) return null

      const previewHeight = Math.round(
        thumbnailPreviewWidth * (thumbnailVideo.videoHeight / thumbnailVideo.videoWidth)
      )

      thumbnailCanvas.width = thumbnailPreviewWidth
      thumbnailCanvas.height = previewHeight

      const context = thumbnailCanvas.getContext('2d')
      if (!context) return null

      context.drawImage(thumbnailVideo, 0, 0, thumbnailPreviewWidth, previewHeight)

      return thumbnailCanvas.toDataURL('image/jpeg', thumbnailPreviewQuality)
    },
    []
  )

  const seekThumbnailVideo = useCallback(
    (thumbnailVideo: HTMLVideoElement, targetTime: number): Promise<void> => {
      return new Promise((resolve, reject) => {
        const cleanup = (): void => {
          thumbnailVideo.removeEventListener('seeked', handleSeeked)
          thumbnailVideo.removeEventListener('error', handleError)
        }

        const handleSeeked = (): void => {
          cleanup()
          resolve()
        }

        const handleError = (): void => {
          cleanup()
          reject(new Error('Thumbnail video seek failed.'))
        }

        if (
          Math.abs(thumbnailVideo.currentTime - targetTime) < 0.08 &&
          thumbnailVideo.readyState >= 2
        ) {
          resolve()
          return
        }

        thumbnailVideo.addEventListener('seeked', handleSeeked, { once: true })
        thumbnailVideo.addEventListener('error', handleError, { once: true })
        thumbnailVideo.currentTime = targetTime
      })
    },
    []
  )

  const ensureThumbnailMetadata = useCallback((thumbnailVideo: HTMLVideoElement): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (thumbnailVideo.readyState >= 1) {
        resolve()
        return
      }

      const cleanup = (): void => {
        thumbnailVideo.removeEventListener('loadedmetadata', handleMetadata)
        thumbnailVideo.removeEventListener('error', handleError)
      }

      const handleMetadata = (): void => {
        cleanup()
        resolve()
      }

      const handleError = (): void => {
        cleanup()
        reject(new Error('Thumbnail metadata failed.'))
      }

      thumbnailVideo.addEventListener('loadedmetadata', handleMetadata, { once: true })
      thumbnailVideo.addEventListener('error', handleError, { once: true })
      thumbnailVideo.load()
    })
  }, [])

  const requestThumbnail = useCallback(
    (time: number) => {
      const thumbnailVideo = thumbnailVideoRef.current
      const thumbnailCanvas = thumbnailCanvasRef.current
      const nearestThumbnailTime = getNearestThumbnailTime(time, duration)
      const cachedImageUrl = thumbnailCacheRef.current.get(nearestThumbnailTime)

      if (cachedImageUrl) {
        setTimelinePreview((preview) => ({
          ...preview,
          imageUrl: cachedImageUrl,
          isLoading: false
        }))
        return
      }

      if (!videoUrl || duration <= 0 || !thumbnailVideo || !thumbnailCanvas) return

      if (thumbnailTimerRef.current) {
        window.clearTimeout(thumbnailTimerRef.current)
      }

      const requestId = thumbnailRequestRef.current + 1
      thumbnailRequestRef.current = requestId

      setTimelinePreview((preview) => ({
        ...preview,
        isLoading: true
      }))

      thumbnailTimerRef.current = window.setTimeout(() => {
        const captureFrame = async (): Promise<void> => {
          if (thumbnailRequestRef.current !== requestId) return

          try {
            await seekThumbnailVideo(thumbnailVideo, nearestThumbnailTime)
            const imageUrl = captureThumbnail(thumbnailVideo, thumbnailCanvas)

            if (imageUrl) {
              thumbnailCacheRef.current.set(nearestThumbnailTime, imageUrl)
            }

            setTimelinePreview((preview) => ({
              ...preview,
              imageUrl,
              isLoading: false
            }))
          } catch {
            setTimelinePreview((preview) => ({
              ...preview,
              imageUrl: null,
              isLoading: false
            }))
          }
        }

        void ensureThumbnailMetadata(thumbnailVideo)
          .then(captureFrame)
          .catch(() => {
            setTimelinePreview((preview) => ({
              ...preview,
              isLoading: false
            }))
          })
      }, 120)
    },
    [captureThumbnail, duration, ensureThumbnailMetadata, seekThumbnailVideo, videoUrl]
  )

  useEffect(() => {
    const thumbnailCacheVideo = thumbnailCacheVideoRef.current
    const thumbnailCacheCanvas = thumbnailCacheCanvasRef.current
    const thumbnailCache = thumbnailCacheRef.current
    const generationId = thumbnailCacheGenerationRef.current + 1

    thumbnailCacheGenerationRef.current = generationId
    thumbnailCache.clear()

    if (!videoUrl || duration <= 0 || !thumbnailCacheVideo || !thumbnailCacheCanvas) return

    const warmupThumbnailCache = async (): Promise<void> => {
      await wait(thumbnailWarmupDelayMs)
      if (thumbnailCacheGenerationRef.current !== generationId) return

      try {
        await ensureThumbnailMetadata(thumbnailCacheVideo)
      } catch {
        return
      }

      for (let time = 0; time <= duration; time += thumbnailIntervalSeconds) {
        if (thumbnailCacheGenerationRef.current !== generationId) return

        const thumbnailTime = getNearestThumbnailTime(time, duration)
        if (thumbnailCache.has(thumbnailTime)) continue

        try {
          await seekThumbnailVideo(thumbnailCacheVideo, thumbnailTime)
          const imageUrl = captureThumbnail(thumbnailCacheVideo, thumbnailCacheCanvas)

          if (imageUrl) {
            thumbnailCache.set(thumbnailTime, imageUrl)
          }
        } catch {
          return
        }

        await wait(8)
      }
    }

    void warmupThumbnailCache()

    return () => {
      thumbnailCacheGenerationRef.current += 1
      thumbnailCache.clear()
    }
  }, [captureThumbnail, duration, ensureThumbnailMetadata, seekThumbnailVideo, videoUrl])

  const updateTimelinePreview = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (duration <= 0) return

      const bounds = event.currentTarget.getBoundingClientRect()
      const offsetX = Math.min(Math.max(event.clientX - bounds.left, 0), bounds.width)
      const percent = bounds.width > 0 ? offsetX / bounds.width : 0
      const time = percent * duration
      const thumbnailTime = getNearestThumbnailTime(time, duration)
      const imageUrl = thumbnailCacheRef.current.get(thumbnailTime) ?? null

      setTimelinePreview({
        isVisible: true,
        time,
        percent,
        imageUrl,
        isLoading: Boolean(videoUrl && !imageUrl)
      })

      if (!imageUrl) {
        requestThumbnail(time)
      }
    },
    [duration, requestThumbnail, videoUrl]
  )

  useEffect(() => {
    thumbnailRequestRef.current += 1
  }, [videoUrl])

  useEffect(() => {
    return () => {
      if (thumbnailTimerRef.current) {
        window.clearTimeout(thumbnailTimerRef.current)
      }
    }
  }, [])

  return (
    <footer
      className="z-10 grid self-end gap-3 px-[22px] pb-[22px]"
      onMouseEnter={onControlsEnter}
      onMouseLeave={onControlsLeave}
    >
      <div className="flex items-center gap-3 text-xs text-[#ebeef8]/80 tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <div
          className="relative min-w-0 flex-1"
          onPointerMove={updateTimelinePreview}
          onPointerLeave={() => {
            setTimelinePreview((preview) => ({
              ...preview,
              isVisible: false,
              isLoading: false
            }))
            if (thumbnailTimerRef.current) {
              window.clearTimeout(thumbnailTimerRef.current)
            }
          }}
        >
          {timelinePreview.isVisible && duration > 0 && (
            <div
              className="pointer-events-none absolute bottom-7 z-20 flex w-[184px] -translate-x-1/2 flex-col gap-1 rounded-lg border border-white/10 bg-black/80 p-2 text-center text-[11px] text-white shadow-[0_14px_42px_rgba(0,0,0,0.45)] backdrop-blur-md"
              style={{
                left: `${Math.min(Math.max(timelinePreview.percent * 100, 4), 96)}%`
              }}
            >
              <div className="grid h-[92px] place-items-center overflow-hidden rounded-md bg-white/10">
                {timelinePreview.imageUrl ? (
                  <img
                    className="h-full w-full object-cover"
                    src={timelinePreview.imageUrl}
                    alt=""
                  />
                ) : (
                  <span className="text-[#ebeef8]/55">
                    {timelinePreview.isLoading ? 'Loading preview...' : 'No preview'}
                  </span>
                )}
              </div>
              <div className="font-semibold tabular-nums">{formatTime(timelinePreview.time)}</div>
            </div>
          )}
          <input
            aria-label="Timeline"
            className="w-full disabled:cursor-not-allowed disabled:opacity-45"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(currentTime, duration || 0)}
            disabled={duration === 0}
            onChange={(event) => onSeek(Number(event.target.value))}
          />
          <video
            ref={thumbnailVideoRef}
            className="hidden"
            src={videoUrl || undefined}
            muted
            playsInline
            preload="metadata"
          />
          <canvas ref={thumbnailCanvasRef} className="hidden" />
          <video
            ref={thumbnailCacheVideoRef}
            className="hidden"
            src={videoUrl || undefined}
            muted
            playsInline
            preload="metadata"
          />
          <canvas ref={thumbnailCacheCanvasRef} className="hidden" />
        </div>
        <span>{formatTime(duration)}</span>
      </div>

      <div className="grid grid-cols-3 items-center gap-4">
        <div className="flex">
          <Tooltip content="Playlist">
            <button
              className={playlistButtonClass}
              type="button"
              onClick={onTogglePlaylist}
              aria-label="Playlist"
            >
              <List size={22} />
            </button>
          </Tooltip>
          <Tooltip content="Hotkeys">
            <button
              className={iconButtonClass}
              type="button"
              onClick={onOpenHotkeys}
              aria-label="Hotkeys"
            >
              <Keyboard size={22} />
            </button>
          </Tooltip>
          <Tooltip content={`Aspect ratio: ${aspectRatioLabel}`}>
            <button
              className={iconButtonClass}
              type="button"
              onClick={onCycleAspectRatio}
              aria-label={`Aspect ratio: ${aspectRatioLabel}`}
            >
              <Ratio size={22} />
            </button>
          </Tooltip>
          <Tooltip
            content={
              subtitleTrackCount > 0
                ? subtitlesEnabled
                  ? `Subtitle: ${activeSubtitleLabel ?? 'On'}`
                  : 'Subtitles off'
                : 'No subtitles'
            }
          >
            <button
              className={`${iconButtonClass} ${subtitlesEnabled && subtitleTrackCount > 0 ? 'bg-white/[0.12]' : ''}`}
              type="button"
              onClick={onToggleSubtitles}
              aria-label="Toggle subtitles"
            >
              <Captions size={22} />
            </button>
          </Tooltip>
        </div>
        <div className="flex items-center justify-center gap-2">
          <Tooltip content="Previous video">
            <button
              className={iconButtonClass}
              type="button"
              onClick={onPlayPrevious}
              disabled={!canPlayPrevious}
              aria-label="Previous video"
            >
              <SkipBack
                size={28}
                fill="currentColor"
                className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
              />
            </button>
          </Tooltip>
          <Tooltip content={isPlaying ? 'Pause' : 'Play'}>
            <button
              className="grid h-14 w-14 place-items-center rounded-[50%] border-[2px] border-[#ffffff] bg-[#ffffff2f] text-[#ffffff] transition-colors duration-300 hover:bg-white hover:*:text-[#000000]"
              type="button"
              onClick={onTogglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause size={24} fill="currentColor" />
              ) : (
                <Play size={24} fill="currentColor" />
              )}
            </button>
          </Tooltip>
          <Tooltip content="Next video">
            <button
              className={playlistButtonClass}
              type="button"
              onClick={onPlayNext}
              disabled={!canPlayNext}
              aria-label="Next video"
            >
              <SkipForward
                size={28}
                fill="currentColor"
                className="opacity-80 transition-opacity duration-300 group-hover:opacity-100"
              />
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Tooltip content={isMuted ? 'Unmute' : 'Mute'}>
            <button
              className={iconButtonClass}
              type="button"
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
            </button>
          </Tooltip>
          <input
            aria-label="Volume"
            className="w-28"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={(event) => onChangeVolume(Number(event.target.value))}
          />
          <Tooltip content="Fullscreen">
            <button
              className={iconButtonClass}
              type="button"
              onClick={onToggleFullscreen}
              aria-label="Fullscreen"
            >
              <Maximize size={20} />
            </button>
          </Tooltip>
        </div>
      </div>
    </footer>
  )
}
