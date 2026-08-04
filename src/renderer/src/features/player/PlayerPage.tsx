import { useCallback, useEffect, useRef, useState } from 'react'
import { FolderOpen, LogOut, Play } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { VideoFile } from '../../../../shared/types/media'
import type { PlayerRouteState } from '../collections/mediaPlayback'
import { HotkeysModal } from './HotkeysModal'
import { PlayerControls } from './PlayerControls'
import { PlaylistPanel } from './PlaylistPanel'
import { Toast, type ToastMessage } from './Toast'
import { createHtmlVideoPlaybackEngine } from './playbackEngine'
import { formatTime } from './time'
import logoIconMonochrome from '../../../../../public/logos/logo-icon-monochrome.png'

const defaultSkipSeconds = 5
const shiftedSkipSeconds = 10
const controlledSkipSeconds = 30
const alternateSkipSeconds = 60
const controlsVisibleMs = 2400
const toastVisibleMs = 1200
const volumeStep = 0.05
const speedStep = 0.25
const minPlaybackRate = 0.25
const maxPlaybackRate = 4
const showControllerPreviewWithoutVideo = import.meta.env.DEV
const previewVideoFile: VideoFile = {
  name: 'Controller preview',
  extension: 'mp4',
  path: 'Preview mode - open a video to test playback',
  url: ''
}
const mediaErrorMessages: Record<number, string> = {
  1: 'Video loading was aborted.',
  2: 'Network error while loading the video.',
  3: 'Video decode failed. The container opened, but the codec may be unsupported.',
  4: 'Unsupported video source or unreadable file.'
}

const videoRatios = ['original', '16:9', '4:3', '16:10', '1:1', '2.21:1', '2.35:1', '5:4'] as const
type VideoRatio = (typeof videoRatios)[number]
type Size = {
  width: number
  height: number
}

function getNextRatio(currentRatio: VideoRatio): VideoRatio {
  const currentIndex = videoRatios.indexOf(currentRatio)
  return videoRatios[(currentIndex + 1) % videoRatios.length]
}

function getRatioValue(ratio: VideoRatio, naturalSize: Size | null): number {
  switch (ratio) {
    case '16:9':
      return 16 / 9
    case '4:3':
      return 4 / 3
    case '16:10':
      return 16 / 10
    case '1:1':
      return 1
    case '2.21:1':
      return 2.21
    case '2.35:1':
      return 2.35
    case '5:4':
      return 5 / 4
    default:
      if (naturalSize && naturalSize.width > 0 && naturalSize.height > 0) {
        return naturalSize.width / naturalSize.height
      }

      return 16 / 9
  }
}

function getContainSize(containerSize: Size, ratio: number): Size {
  if (containerSize.width <= 0 || containerSize.height <= 0) {
    return { width: 0, height: 0 }
  }

  const containerRatio = containerSize.width / containerSize.height

  if (containerRatio > ratio) {
    return {
      width: containerSize.height * ratio,
      height: containerSize.height
    }
  }

  return {
    width: containerSize.width,
    height: containerSize.width / ratio
  }
}

function formatSkipAmount(seconds: number): string {
  if (seconds === 60) return '1 Minute'

  return `${seconds} Sec`
}

function getKeyboardSkipSeconds(event: KeyboardEvent): number {
  if (event.altKey) return alternateSkipSeconds
  if (event.ctrlKey) return controlledSkipSeconds
  if (event.shiftKey) return shiftedSkipSeconds

  return defaultSkipSeconds
}

function openBrowserVideoFile(): Promise<VideoFile | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')

    input.type = 'file'
    input.accept = 'video/*,.mp4,.mkv,.webm,.mov,.avi,.m4v'
    input.onchange = () => {
      const file = input.files?.[0]

      if (!file) {
        resolve(null)
        return
      }

      const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

      resolve({
        name: file.name,
        extension,
        path: file.name,
        url: URL.createObjectURL(file)
      })
    }

    input.click()
  })
}

export function PlayerPage(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()
  const initialRouteState = location.state as PlayerRouteState | null
  const initialPlaylist = initialRouteState?.playlist ?? []
  const initialSelectedIndex =
    initialPlaylist.length > 0
      ? Math.min(initialRouteState?.selectedIndex ?? 0, initialPlaylist.length - 1)
      : null
  const initialCollectionName =
    initialRouteState?.collectionName ?? initialPlaylist[0]?.collectionName ?? null
  const returnTo = initialRouteState?.returnTo ?? null
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const shellRef = useRef<HTMLDivElement | null>(null)
  const playerStageRef = useRef<HTMLDivElement | null>(null)
  const controlsTimerRef = useRef<number | null>(null)
  const toastTimerRef = useRef<number | null>(null)
  const controlsPinnedRef = useRef(false)
  const shouldAutoplayRef = useRef(initialPlaylist.length > 0)
  const [videoFile, setVideoFile] = useState<VideoFile | null>(
    initialSelectedIndex === null ? null : (initialPlaylist[initialSelectedIndex] ?? null)
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.85)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [showHotkeys, setShowHotkeys] = useState(false)
  const [showPlaylist, setShowPlaylist] = useState(initialPlaylist.length > 1)
  const [playlist, setPlaylist] = useState<VideoFile[]>(initialPlaylist)
  const [activePlaylistIndex, setActivePlaylistIndex] = useState<number | null>(
    initialSelectedIndex
  )
  const [collectionName, setCollectionName] = useState<string | null>(initialCollectionName)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [aspectRatio, setAspectRatio] = useState<VideoRatio>('original')
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true)
  const [playerStageSize, setPlayerStageSize] = useState<Size>({ width: 0, height: 0 })
  const [naturalVideoSize, setNaturalVideoSize] = useState<Size | null>(null)

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

  useEffect(() => {
    const playerStage = playerStageRef.current
    if (!playerStage) return

    const updatePlayerStageSize = (): void => {
      setPlayerStageSize({
        width: playerStage.clientWidth,
        height: playerStage.clientHeight
      })
    }

    updatePlayerStageSize()

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]

      if (!entry) {
        updatePlayerStageSize()
        return
      }

      setPlayerStageSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height
      })
    })

    observer.observe(playerStage)

    return () => {
      observer.disconnect()
    }
  }, [])

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

  const activateVideo = useCallback(
    (nextVideo: VideoFile, nextIndex: number, autoplay: boolean) => {
      shouldAutoplayRef.current = autoplay
      setVideoFile(nextVideo)
      setActivePlaylistIndex(nextIndex)
      setCurrentTime(0)
      setDuration(0)
      setIsPlaying(false)
      setError(null)
      setNaturalVideoSize(null)
    },
    []
  )

  const openVideo = useCallback(async () => {
    setError(null)

    try {
      const result = window.api
        ? await window.api.media.openVideo()
        : await openBrowserVideoFile().then((video) =>
            video
              ? { canceled: false as const, video, playlist: [video], selectedIndex: 0 }
              : { canceled: true as const }
          )

      if (result.canceled || !result.video) return

      const nextPlaylist = result.playlist.length > 0 ? result.playlist : [result.video]
      const nextSelectedIndex = Math.min(result.selectedIndex, nextPlaylist.length - 1)

      setPlaylist(nextPlaylist)
      setCollectionName(null)
      activateVideo(nextPlaylist[nextSelectedIndex] ?? result.video, nextSelectedIndex, true)
      setAspectRatio('original')
      setShowPlaylist(nextPlaylist.length > 1)
      revealControls()
    } catch {
      setError('Could not open the selected video.')
      revealControls()
    }
  }, [activateVideo, revealControls])

  const exitPlayer = useCallback(() => {
    navigate(returnTo && returnTo !== '/player' ? returnTo : '/home')
  }, [navigate, returnTo])

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
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate
    }
  }, [playbackRate])

  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        window.clearTimeout(controlsTimerRef.current)
      }

      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current)
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

  const showToast = useCallback((message: ToastMessage) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current)
    }

    setToast(message)

    toastTimerRef.current = window.setTimeout(() => {
      setToast(null)
    }, toastVisibleMs)
  }, [])

  const showSkipToast = useCallback(
    (seconds: number, targetTime: number) => {
      const direction = seconds >= 0 ? 'Forward' : 'Backward'

      showToast({
        title: `Skip ${formatSkipAmount(Math.abs(seconds))} ${direction}`,
        description: `${formatTime(targetTime)} / ${formatTime(duration)}`
      })
    },
    [duration, showToast]
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
      showSkipToast(seconds, safeTargetTime)
    },
    [currentTime, duration, seekTo, showSkipToast]
  )

  const playPlaylistItem = useCallback(
    (nextIndex: number, autoplay = true) => {
      const nextVideo = playlist[nextIndex]
      if (!nextVideo) return

      activateVideo(nextVideo, nextIndex, autoplay)
      revealControls()
    },
    [activateVideo, playlist, revealControls]
  )

  const playNextPlaylistItem = useCallback(() => {
    if (activePlaylistIndex === null) return

    const nextIndex = activePlaylistIndex + 1
    if (nextIndex >= playlist.length) {
      setIsPlaying(false)
      revealControls()
      showToast({ title: 'End of Playlist' })
      return
    }

    playPlaylistItem(nextIndex, true)
    showToast({
      title: 'Next Video',
      description: playlist[nextIndex]?.name
    })
  }, [activePlaylistIndex, playPlaylistItem, playlist, revealControls, showToast])

  const playPreviousPlaylistItem = useCallback(() => {
    if (activePlaylistIndex === null) return

    const previousIndex = activePlaylistIndex - 1
    if (previousIndex < 0) {
      showToast({ title: 'Start of Playlist' })
      revealControls()
      return
    }

    playPlaylistItem(previousIndex, true)
    showToast({
      title: 'Previous Video',
      description: playlist[previousIndex]?.name
    })
  }, [activePlaylistIndex, playPlaylistItem, playlist, revealControls, showToast])

  const reorderPlaylist = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return
      if (fromIndex >= playlist.length || toIndex >= playlist.length) return

      const reorderedPlaylist = [...playlist]
      const [movedVideo] = reorderedPlaylist.splice(fromIndex, 1)

      if (!movedVideo) return

      reorderedPlaylist.splice(toIndex, 0, movedVideo)
      setPlaylist(reorderedPlaylist)

      if (videoFile) {
        const nextActiveIndex = reorderedPlaylist.findIndex(
          (video) => video.path === videoFile.path
        )
        setActivePlaylistIndex(nextActiveIndex >= 0 ? nextActiveIndex : null)
      }
    },
    [playlist, videoFile]
  )

  const removePlaylistItem = useCallback(
    (index: number) => {
      const removedVideo = playlist[index]
      if (!removedVideo) return

      const nextPlaylist = playlist.filter((_, itemIndex) => itemIndex !== index)
      setPlaylist(nextPlaylist)

      if (videoFile?.path === removedVideo.path) {
        const replacementIndex = Math.min(index, nextPlaylist.length - 1)
        const replacementVideo = nextPlaylist[replacementIndex]

        if (replacementVideo) {
          activateVideo(replacementVideo, replacementIndex, true)
        } else {
          getEngine()?.destroy()
          setVideoFile(null)
          setActivePlaylistIndex(null)
          setCurrentTime(0)
          setDuration(0)
          setIsPlaying(false)
          setError(null)
          setNaturalVideoSize(null)
        }
      } else if (videoFile) {
        const nextActiveIndex = nextPlaylist.findIndex((item) => item.path === videoFile.path)
        setActivePlaylistIndex(nextActiveIndex >= 0 ? nextActiveIndex : null)
      }

      showToast({ title: 'Removed from Playlist', description: removedVideo.name })
      revealControls()
    },
    [activateVideo, getEngine, playlist, revealControls, showToast, videoFile]
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

  const changeVolumeBy = useCallback(
    (delta: number) => {
      const nextVolume = Math.min(Math.max(volume + delta, 0), 1)

      changeVolume(nextVolume)
      showToast({
        title: delta > 0 ? 'Volume Up' : 'Volume Down',
        description: `${Math.round(nextVolume * 100)}%`
      })
    },
    [changeVolume, showToast, volume]
  )

  const toggleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    const nextMuted = !video.muted
    video.muted = nextMuted
    setIsMuted(nextMuted)
    showToast({ title: nextMuted ? 'Mute' : 'Unmute' })
    revealControls()
  }, [revealControls, showToast])

  const toggleFullscreen = useCallback(async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      showToast({ title: 'Exit Fullscreen' })
      revealControls()
      return
    }

    await shellRef.current?.requestFullscreen()
    showToast({ title: 'Enter Fullscreen' })
    revealControls()
  }, [revealControls, showToast])

  const stopVideo = useCallback(() => {
    getEngine()?.destroy()
    setVideoFile(null)
    setCollectionName(null)
    setActivePlaylistIndex(null)
    setCurrentTime(0)
    setDuration(0)
    setIsPlaying(false)
    setError(null)
    setNaturalVideoSize(null)
    showToast({ title: 'Stop' })
    revealControls()
  }, [getEngine, revealControls, showToast])

  const changePlaybackRateBy = useCallback(
    (delta: number) => {
      const nextRate = Math.min(Math.max(playbackRate + delta, minPlaybackRate), maxPlaybackRate)
      const safeRate = Number(nextRate.toFixed(2))

      setPlaybackRate(safeRate)
      showToast({
        title: delta > 0 ? 'Speed Up' : 'Speed Down',
        description: `${safeRate.toFixed(2)}x`
      })
      revealControls()
    },
    [playbackRate, revealControls, showToast]
  )

  const resetPlaybackRate = useCallback(() => {
    setPlaybackRate(1)
    showToast({ title: 'Speed Reset', description: '1.00x' })
    revealControls()
  }, [revealControls, showToast])

  const cycleAspectRatio = useCallback(() => {
    const nextRatio = getNextRatio(aspectRatio)

    setAspectRatio(nextRatio)
    showToast({ title: 'Aspect Ratio', description: nextRatio })
    revealControls()
  }, [aspectRatio, revealControls, showToast])

  const toggleSubtitles = useCallback(() => {
    const video = videoRef.current
    const nextEnabled = !subtitlesEnabled

    if (video) {
      for (const track of Array.from(video.textTracks)) {
        track.mode = nextEnabled ? 'showing' : 'disabled'
      }
    }

    setSubtitlesEnabled(nextEnabled)
    showToast({ title: nextEnabled ? 'Subtitles On' : 'Subtitles Off' })
    revealControls()
  }, [revealControls, showToast, subtitlesEnabled])

  const switchAudioTrack = useCallback(() => {
    showToast({ title: 'Audio Track', description: 'Not available yet' })
    revealControls()
  }, [revealControls, showToast])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.target instanceof HTMLInputElement) return

      if (showHotkeys) {
        if (event.code === 'Escape') {
          event.preventDefault()
          setShowHotkeys(false)
          showToast({ title: 'Close Hotkeys' })
        }
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        showToast({ title: isPlaying ? 'Pause' : 'Play' })
        void togglePlay()
      }

      if (event.code === 'KeyG') {
        event.preventDefault()
        setShowHotkeys(true)
        showToast({ title: 'Open Hotkeys' })
        revealControls()
      }

      if (event.code === 'KeyL') {
        event.preventDefault()
        setShowPlaylist((isVisible) => !isVisible)
        showToast({ title: showPlaylist ? 'Close Playlist' : 'Open Playlist' })
        revealControls()
      }

      if (event.code === 'ArrowLeft') {
        event.preventDefault()
        skipBy(-getKeyboardSkipSeconds(event))
      }

      if (event.code === 'ArrowRight') {
        event.preventDefault()
        skipBy(getKeyboardSkipSeconds(event))
      }

      if (event.code === 'ArrowUp') {
        event.preventDefault()
        changeVolumeBy(volumeStep)
      }

      if (event.code === 'ArrowDown') {
        event.preventDefault()
        changeVolumeBy(-volumeStep)
      }

      if (event.code === 'KeyM') {
        event.preventDefault()
        toggleMute()
      }

      if (event.code === 'KeyF') {
        event.preventDefault()
        void toggleFullscreen()
      }

      if (event.code === 'Escape') {
        event.preventDefault()
        if (document.fullscreenElement) {
          void document.exitFullscreen()
          showToast({ title: 'Exit Fullscreen' })
        } else {
          showToast({ title: 'Hide Overlay' })
        }
        setShowControls(false)
      }

      if (event.code === 'KeyS' && event.ctrlKey) {
        event.preventDefault()
        stopVideo()
      }

      if (event.code === 'KeyN') {
        event.preventDefault()
        playNextPlaylistItem()
      }

      if (event.code === 'KeyP') {
        event.preventDefault()
        playPreviousPlaylistItem()
      }

      if (event.code === 'BracketLeft') {
        event.preventDefault()
        changePlaybackRateBy(-speedStep)
      }

      if (event.code === 'BracketRight') {
        event.preventDefault()
        changePlaybackRateBy(speedStep)
      }

      if (event.code === 'Backslash') {
        event.preventDefault()
        resetPlaybackRate()
      }

      if (event.code === 'KeyA') {
        event.preventDefault()
        cycleAspectRatio()
      }

      if (event.code === 'KeyH') {
        event.preventDefault()
        toggleSubtitles()
      }

      if (event.code === 'KeyB') {
        event.preventDefault()
        switchAudioTrack()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [
    changePlaybackRateBy,
    changeVolumeBy,
    cycleAspectRatio,
    playNextPlaylistItem,
    playPreviousPlaylistItem,
    revealControls,
    resetPlaybackRate,
    showHotkeys,
    showPlaylist,
    showToast,
    isPlaying,
    skipBy,
    stopVideo,
    switchAudioTrack,
    toggleFullscreen,
    toggleMute,
    togglePlay,
    toggleSubtitles
  ])

  const displayedVideoFile =
    videoFile ?? (showControllerPreviewWithoutVideo ? previewVideoFile : null)
  const displayedCurrentTime = videoFile ? currentTime : 0
  const displayedDuration = videoFile ? duration : 0
  const displayedIsPlaying = videoFile ? isPlaying : false
  const isPreviewingControls = showControllerPreviewWithoutVideo && !videoFile
  const isOverlayVisible = isPreviewingControls || showControls || toast !== null
  const controlsClassName = isOverlayVisible
    ? 'pointer-events-auto absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] opacity-100 transition-opacity duration-150'
    : 'pointer-events-none absolute inset-0 z-20 grid grid-rows-[auto_minmax(0,1fr)_auto] opacity-0 transition-opacity duration-150'
  const activeVideoRatio = getRatioValue(aspectRatio, naturalVideoSize)
  const containedVideoSize = getContainSize(playerStageSize, activeVideoRatio)
  const videoFrameStyle =
    containedVideoSize.width > 0 && containedVideoSize.height > 0
      ? { width: `${containedVideoSize.width}px`, height: `${containedVideoSize.height}px` }
      : undefined
  const videoFrameClassName =
    'grid min-h-0 min-w-0 place-items-center overflow-hidden bg-[#050608] transition-[width,height] duration-300 ease-out'
  const videoClassName = 'block h-full w-full bg-[#050608] object-fill'
  const shellClassName = showPlaylist
    ? 'grid h-[calc(100vh-36px)] grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.08] bg-[#050608] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-[grid-template-columns] duration-300 ease-out'
    : 'grid h-[calc(100vh-36px)] grid-cols-[0px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.08] bg-[#050608] shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-[grid-template-columns] duration-300 ease-out'

  return (
    <main className="min-h-screen bg-[#101114] p-[18px]">
      <section className={shellClassName} ref={shellRef}>
        <div className="min-w-0 overflow-hidden">
          <PlaylistPanel
            isVisible={showPlaylist}
            playlist={playlist}
            activeIndex={activePlaylistIndex}
            collectionName={collectionName}
            onPlay={playPlaylistItem}
            onRemove={removePlaylistItem}
            onReorder={reorderPlaylist}
          />
        </div>
        <div
          ref={playerStageRef}
          className="relative grid h-full min-h-0 min-w-0 place-items-center overflow-hidden bg-[#08090b] transition-[width] duration-300 ease-out"
          onMouseMove={videoFile ? revealControls : undefined}
        >
          {!displayedVideoFile && (
            <button
              className="absolute z-10 inline-flex items-center gap-3 rounded-lg border border-white/12 bg-[#1c1f26]/90 px-[18px] py-3.5 font-bold text-[#f3f5fb]"
              type="button"
              onClick={openVideo}
            >
              <FolderOpen size={32} />
              <span>Open a video file</span>
            </button>
          )}

          <div className={videoFrameClassName} style={videoFrameStyle}>
            <video
              ref={videoRef}
              autoPlay
              className={videoClassName}
              preload="metadata"
              onCanPlay={() => {
                if (!shouldAutoplayRef.current) return

                shouldAutoplayRef.current = false
                void playCurrentVideo()
              }}
              onClick={() => void togglePlay()}
              onLoadedMetadata={(event) => {
                const video = event.currentTarget

                setDuration(video.duration)
                if (video.videoWidth > 0 && video.videoHeight > 0) {
                  setNaturalVideoSize({
                    width: video.videoWidth,
                    height: video.videoHeight
                  })
                }
              }}
              onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
              onEnded={playNextPlaylistItem}
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
          </div>

          {displayedVideoFile && (
            <div className={controlsClassName}>
              <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-40 bg-gradient-to-b from-black/70 to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[230px] bg-gradient-to-t from-black/85 to-transparent" />
              <Toast message={toast} />

              <header className="z-10 flex items-center justify-between gap-4 px-[22px] py-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg bg-[#e9edf9]">
                    <img
                      className="h-[26px] w-[26px] object-contain"
                      src={logoIconMonochrome}
                      alt=""
                    />
                  </span>
                  <div>
                    <h1 className="max-w-[62vw] truncate text-lg leading-[22px] font-bold text-[#f3f5fb]">
                      {collectionName ?? 'NexMP'}
                    </h1>
                    <p className="max-w-[62vw] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] leading-[18px] text-[#ebeef8]/70">
                      {displayedVideoFile.name}
                    </p>
                  </div>
                </div>

                <button
                  className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-md bg-[#e9edf9] px-3.5 font-bold text-[#111319]"
                  type="button"
                  onClick={exitPlayer}
                >
                  <LogOut size={18} />
                  Exit
                </button>
              </header>

              {!displayedIsPlaying && (
                <button
                  className="z-10 grid h-[74px] w-[74px] place-items-center self-center justify-self-center rounded-full bg-[#e9edf9]/90 text-[#111319] shadow-[0_14px_40px_rgba(0,0,0,0.34)]"
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
                videoFile={displayedVideoFile}
                isPlaying={displayedIsPlaying}
                isMuted={isMuted}
                currentTime={displayedCurrentTime}
                duration={displayedDuration}
                volume={volume}
                aspectRatioLabel={aspectRatio}
                canPlayPrevious={activePlaylistIndex !== null && activePlaylistIndex > 0}
                canPlayNext={
                  activePlaylistIndex !== null && activePlaylistIndex < playlist.length - 1
                }
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
                onCycleAspectRatio={cycleAspectRatio}
                onPlayPrevious={playPreviousPlaylistItem}
                onPlayNext={playNextPlaylistItem}
                onOpenHotkeys={() => {
                  setShowHotkeys(true)
                  revealControls()
                }}
                onTogglePlaylist={() => {
                  setShowPlaylist((isVisible) => !isVisible)
                  revealControls()
                }}
                onToggleFullscreen={() => void toggleFullscreen()}
                onToggleMute={toggleMute}
                onTogglePlay={() => void togglePlay()}
              />
            </div>
          )}
          {showHotkeys && <HotkeysModal onClose={() => setShowHotkeys(false)} />}
        </div>
      </section>
    </main>
  )
}
