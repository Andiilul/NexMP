export type PlaybackEngine = {
  load: (source: string) => void
  play: () => Promise<void>
  pause: () => void
  seek: (seconds: number) => void
  setVolume: (volume: number) => void
  destroy: () => void
}

export function createHtmlVideoPlaybackEngine(video: HTMLVideoElement): PlaybackEngine {
  return {
    load(source): void {
      video.src = source
      video.load()
    },
    play(): Promise<void> {
      return video.play()
    },
    pause(): void {
      video.pause()
    },
    seek(seconds): void {
      const safeTime = Math.min(
        Math.max(seconds, 0),
        Number.isFinite(video.duration) ? video.duration : 0
      )
      video.currentTime = safeTime
    },
    setVolume(volume): void {
      video.volume = Math.min(Math.max(volume, 0), 1)
    },
    destroy(): void {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }
}
