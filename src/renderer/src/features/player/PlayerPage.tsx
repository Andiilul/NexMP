import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, Play } from 'lucide-react'
import type { VideoFile } from '../../../../shared/types/media'
import { PlayerControls } from './PlayerControls'
import { SkipIndicator, type SkipFeedback } from './SkipIndicator'
import { createHtmlVideoPlaybackEngine } from './playbackEngine'

const defaultSkipSeconds = 5
const shiftedSkipSeconds = 10
const controlledSkipSeconds = 30
const alternateSkipSeconds = 60
const controlsVisibleMs = 2400
const skipFeedbackVisibleMs = 1200
const mediaErrorMessages: Record<number, string> = {
  1: 'Video loading was aborted.',
  2: 'Network error while loading the video.',
  3: 'Video decode failed. The container opened, but the codec may be unsupported.',
  4: 'Unsupported video source or unreadable file.'
}

function getKeyboardSkipSeconds(event: KeyboardEvent): number {
  if (event.altKey) return alternateSkipSeconds
  if (event.ctrlKey) return controlledSkipSeconds
  if (event.shiftKey) return shiftedSkipSeconds

  return defaultSkipSeconds
}

export function PlayerPage(): React.JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const controlsTimerRef = useRef<number | null>(null)
  const skipFeedbackTimerRef = useRef<number | null>(null)
  const controlsPinnedRef = useRef(false)
  const shouldAutoplayRef = useRef(false)
  const [videoFile, setVideoFile] = useState<VideoFile | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [error, setError] = useState<string | null>(null)
  const [skipFeedback, setSkipFeedback] = useState<SkipFeedback | null>(null)

  const getEngine = useCallback(() => {
    if (!videoRef.current) return null

    return createHtmlVideoPlaybackEngine(videoRef.current)
  }, [])

  const hideControlsLater = useCallback(() => {
    if (controlsTimerRef.current) {
      window.clearTimeout(controlsTimerRef.current)
    }

    controlsTimerRef.current = window.setTimeout(() => {
      if (!controlsPinnedRef.current) {
        setShowControls(false)
      }
    }, controlsVisibleMs)
  }, [])

  const revealControls = useCallback(() => {
    setShowControls(true)
    hideControlsLater()
  }, [hideControlsLater])

  const playCurrentVideo = useCallback(async () => {
    const engine = getEngine()
    if (!engine || !videoFile) return

    setError(null)

    try {
      await engine.play()
    } catch {
      setError('This video could not be played. Try an MP4 H.264/AAC file first.')
      revealControls()
    }
  }, [getEngine, revealControls, videoFile])

  const openVideo = useCallback(async () => {
    setError(null)

    try {
      const result = await window.api.media.openVideo()

      if (result.canceled) return

      shouldAutoplayRef.current = true
      setVideoFile(result.video)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
      revealControls()
    } catch {
      setError('Could not open the selected video.')
      revealControls()
    }
  }, [revealControls])

  useEffect(() => {
    const engine = getEngine()
    if (!engine || !videoFile) return

    engine.load(videoFile.url)

    return () => {
      engine.destroy()
    }
  }, [getEngine, videoFile])

  useEffect(() => {
    getEngine()?.setVolume(volume)
  }, [getEngine, volume])

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current)
      }

      if (skipFeedbackTimerRef.current) {
        window.clearTimeout(skipFeedbackTimerRef.current)
      }
    }
  }, [])

  const togglePlay = useCallback(async () => {
    const video = videoRef.current
    const engine = getEngine()
    if (!video || !engine || !videoFile) return

    setError(null)

    try {
      if (video.paused) {
        await engine.play()
        hideControlsLater()
      } else {
        engine.pause()
        revealControls()
      }
    } catch {
      setError('This video could not be played. Try an MP4 H.264/AAC file first.')
      revealControls()
    }
  }, [getEngine, hideControlsLater, revealControls, videoFile])

  const showSkipFeedback = useCallback(
    (seconds: number, targetTime: number) => {
      if (skipFeedbackTimerRef.current) {
        window.clearTimeout(skipFeedbackTimerRef.current)
      }

      setSkipFeedback({
        seconds: Math.abs(seconds),
        direction: seconds >= 0 ? 'forward' : 'backward',
        currentTime: targetTime,
        duration
      })

      skipFeedbackTimerRef.current = window.setTimeout(() => {
        setSkipFeedback(null)
      }, skipFeedbackVisibleMs)
    },
    [duration]
  )

  const seekTo = useCallback(
    (seconds: number) => {
      const engine = getEngine()
      if (!engine || !videoFile) return

      engine.seek(seconds)
      setCurrentTime(seconds)
      revealControls()
    },
    [getEngine, revealControls, videoFile]
  )

  const skipBy = useCallback(
    (seconds: number) => {
      const safeTargetTime = Math.min(Math.max(currentTime + seconds, 0), duration || 0)

      seekTo(safeTargetTime)
      showSkipFeedback(seconds, safeTargetTime)
    },
    [currentTime, duration, seekTo, showSkipFeedback]
  )

  const changeVolume = useCallback(
    (nextVolume: number) => {
      const safeVolume = Math.min(Math.max(nextVolume, 0), 1)

      setVolume(safeVolume)
      setIsMuted(safeVolume === 0)
      if (videoRef.current) {
        videoRef.current.muted = safeVolume === 0
      }
      getEngine()?.setVolume(safeVolume)
      revealControls()
    },
    [getEngine, revealControls]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
    revealControls()
  }, [revealControls])

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      revealControls()
      return
    }

    await shellRef.current?.requestFullscreen()
    revealControls()
  }, [revealControls])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return

      if (event.code === 'Space') {
        event.preventDefault()
        void togglePlay()
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        skipBy(-getKeyboardSkipSeconds(event))
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault()
        skipBy(getKeyboardSkipSeconds(event))
      }

      if (event.code === 'KeyM') {
        event.preventDefault()
        toggleMute()
      }

      if (event.code === 'KeyF') {
        event.preventDefault()
        void toggleFullscreen()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [skipBy, toggleFullscreen, toggleMute, togglePlay])

  const isOverlayVisible = showControls || skipFeedback !== null
  const controlsClassName = isOverlayVisible
    ? 'pointer-events-auto absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] opacity-0 transition-opacity duration-150'

  return (
    <main className="from-nex-ink via-nex-black to-nex-black min-h-screen bg-gradient-to-br p-[18px]">
      <section
        className="border-nex-green/15 bg-nex-black h-[calc(100vh-36px)] overflow-hidden rounded-lg border shadow-[0_24px_80px_rgba(0,217,130,0.08)]"
        ref={shellRef}
      >
        <div
          className="bg-nex-black relative grid h-full w-full place-items-center overflow-hidden"
          onMouseMove={videoFile ? revealControls : undefined}
        >
          {!videoFile && (
            <button
              className="border-nex-green/30 bg-nex-panel/90 text-nex-white hover:border-nex-green hover:bg-nex-deep absolute z-10 inline-flex items-center gap-3 rounded-lg border px-[18px] py-3.5 font-bold shadow-[0_18px_60px_rgba(0,217,130,0.12)]"
              type="button"
              onClick={openVideo}
            >
              <img className="h-8 w-8 object-contain" src="/logos/logo-icon.png" alt="" />
              <span>Open a video file</span>
            </button>
          )}

          <video
            ref={videoRef}
            autoPlay
            className="bg-nex-black block h-full w-full object-contain"
            preload="metadata"
            onCanPlay={() => {
              if (!shouldAutoplayRef.current) return

              shouldAutoplayRef.current = false
              void playCurrentVideo()
            }}
            onClick={() => void togglePlay()}
            onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
            onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
            onPlay={() => {
              setIsPlaying(true)
              hideControlsLater()
            }}
            onPause={() => {
              setIsPlaying(false)
              revealControls()
            }}
            onVolumeChange={(event) => {
              setIsMuted(event.currentTarget.muted)
              setVolume(event.currentTarget.volume)
            }}
            onError={(event) => {
              const errorCode = event.currentTarget.error?.code
              setError(
                errorCode
                  ? mediaErrorMessages[errorCode]
                  : 'Unsupported video format or unreadable file.'
              )
              revealControls()
            }}
          />

          {videoFile && (
            <div className={controlsClassName}>
              <div className="from-nex-black/75 pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b to-transparent" />
              <div className="from-nex-black/90 pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[230px] bg-gradient-to-t to-transparent" />
              <SkipIndicator feedback={skipFeedback} />

              <header className="z-10 flex items-center justify-between gap-4 px-[22px] py-5">
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    className="h-[38px] w-[38px] shrink-0 object-contain"
                    src="/logos/logo-icon.png"
                    alt=""
                  />
                  <div>
                    <h1 className="text-nex-green text-lg leading-[22px] font-bold">NexMP</h1>
                    <p className="text-nex-muted max-w-[62vw] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[18px]">
                      {videoFile.name}
                    </p>
                  </div>
                </div>

                <button
                  className="bg-nex-green text-nex-black hover:bg-nex-white inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md px-3.5 font-bold"
                  type="button"
                  onClick={openVideo}
                >
                  <FolderOpen size={18} />
                  Open video
                </button>
              </header>

              {!isPlaying && (
                <button
                  className="bg-nex-green/95 text-nex-black hover:bg-nex-white z-10 grid h-[74px] w-[74px] place-items-center self-center justify-self-center rounded-full shadow-[0_14px_40px_rgba(0,217,130,0.24)]"
                  type="button"
                  onClick={() => void togglePlay()}
                  aria-label="Play"
                >
                  <Play size={34} fill="currentColor" />
                </button>
              )}

              {error && (
                <div className="z-10 mx-[22px] mb-3 self-end rounded-md border border-[#ff6f60]/25 bg-[#3e1c1f]/90 px-3 py-2.5 text-[13px] text-[#ffb8ae]">
                  {error}
                </div>
              )}

              <PlayerControls
                videoFile={videoFile}
                isPlaying={isPlaying}
                isMuted={isMuted}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                onChangeVolume={changeVolume}
                onControlsEnter={() => {
                  controlsPinnedRef.current = true
                  setShowControls(true)
                }}
                onControlsLeave={() => {
                  controlsPinnedRef.current = false
                  hideControlsLater()
                }}
                onSeek={seekTo}
                onSkip={skipBy}
                onToggleFullscreen={() => void toggleFullscreen()}
                onToggleMute={toggleMute}
                onTogglePlay={() => void togglePlay()}
              />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
