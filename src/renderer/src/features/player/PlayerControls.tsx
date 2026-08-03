import { FastForward, Maximize, Pause, Play, Rewind, Volume2, VolumeX } from 'lucide-react'
import type { VideoFile } from '../../../../shared/types/media'
import { formatTime } from './time'

type PlayerControlsProps = {
  videoFile: VideoFile
  isPlaying: boolean
  isMuted: boolean
  currentTime: number
  duration: number
  volume: number
  onChangeVolume: (volume: number) => void
  onControlsEnter: () => void
  onControlsLeave: () => void
  onSeek: (seconds: number) => void
  onSkip: (seconds: number) => void
  onToggleFullscreen: () => void
  onToggleMute: () => void
  onTogglePlay: () => void
}

const skipSeconds = 5
const iconButtonClass =
  'border-nex-white/10 text-nex-white hover:border-nex-green/50 hover:bg-nex-green/20 grid h-[38px] w-[38px] place-items-center rounded-md border bg-nex-white/10 backdrop-blur-md'
const playButtonClass =
  'bg-nex-green text-nex-black hover:bg-nex-white grid h-[38px] w-12 place-items-center rounded-md'

export function PlayerControls({
  videoFile,
  isPlaying,
  isMuted,
  currentTime,
  duration,
  volume,
  onChangeVolume,
  onControlsEnter,
  onControlsLeave,
  onSeek,
  onSkip,
  onToggleFullscreen,
  onToggleMute,
  onTogglePlay
}: PlayerControlsProps): React.JSX.Element {
  return (
    <footer
      className="z-10 grid self-end gap-3 px-[22px] pb-[22px]"
      onMouseEnter={onControlsEnter}
      onMouseLeave={onControlsLeave}
    >
      <div className="text-nex-muted flex items-center gap-3 text-xs tabular-nums">
        <span>{formatTime(currentTime)}</span>
        <input
          aria-label="Timeline"
          className="min-w-0 flex-1"
          type="range"
          min="0"
          max={duration || 0}
          step="0.1"
          value={Math.min(currentTime, duration || 0)}
          disabled={duration === 0}
          onChange={(event) => onSeek(Number(event.target.value))}
        />
        <span>{formatTime(duration)}</span>
      </div>

      <div className="grid grid-cols-[164px_minmax(0,1fr)_210px] items-center gap-4">
        <div className="flex items-center gap-2">
          <button className={iconButtonClass} type="button" onClick={() => onSkip(-skipSeconds)}>
            <Rewind size={20} />
          </button>
          <button className={playButtonClass} type="button" onClick={onTogglePlay}>
            {isPlaying ? (
              <Pause size={24} fill="currentColor" />
            ) : (
              <Play size={24} fill="currentColor" />
            )}
          </button>
          <button className={iconButtonClass} type="button" onClick={() => onSkip(skipSeconds)}>
            <FastForward size={20} />
          </button>
        </div>

        <div className="text-nex-muted min-w-0 text-xs leading-[18px]">
          <span className="text-nex-green mr-2 inline-block font-extrabold">
            {videoFile.extension.toUpperCase() || 'VIDEO'}
          </span>
          <strong className="inline-block max-w-[calc(100%-72px)] overflow-hidden text-ellipsis whitespace-nowrap align-bottom font-medium">
            {videoFile.path}
          </strong>
        </div>

        <div className="flex items-center justify-end gap-2">
          <button className={iconButtonClass} type="button" onClick={onToggleMute}>
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
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
          <button className={iconButtonClass} type="button" onClick={onToggleFullscreen}>
            <Maximize size={20} />
          </button>
        </div>
      </div>
    </footer>
  )
}
