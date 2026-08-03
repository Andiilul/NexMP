import { formatTime } from './time'

export type SkipDirection = 'forward' | 'backward'

export type SkipFeedback = {
  seconds: number
  direction: SkipDirection
  currentTime: number
  duration: number
}

type SkipIndicatorProps = {
  feedback: SkipFeedback | null
}

function formatSkipAmount(seconds: number): string {
  if (seconds === 60) return '1 Minute'

  return `${seconds} Sec`
}

function formatDirection(direction: SkipDirection): string {
  return direction === 'forward' ? 'Forward' : 'Backward'
}

export function SkipIndicator({ feedback }: SkipIndicatorProps): React.JSX.Element | null {
  if (!feedback) return null

  return (
    <div className="border-nex-green/25 bg-nex-black/65 text-nex-white pointer-events-none absolute top-[78px] left-[22px] z-30 rounded-md border px-3 py-2 text-left text-xs shadow-[0_10px_32px_rgba(0,217,130,0.14)] backdrop-blur-md">
      <div className="text-nex-green font-bold">
        Skip {formatSkipAmount(feedback.seconds)} {formatDirection(feedback.direction)}
      </div>
      <div className="text-nex-muted mt-0.5 tabular-nums">
        {formatTime(feedback.currentTime)} / {formatTime(feedback.duration)}
      </div>
    </div>
  )
}
