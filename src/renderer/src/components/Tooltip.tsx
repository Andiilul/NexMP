import type { ReactNode } from 'react'
import { clsx } from 'clsx'

type TooltipSide = 'top' | 'bottom'

type TooltipProps = {
  children: ReactNode
  content: ReactNode
  side?: TooltipSide
}

const tooltipSideClass: Record<TooltipSide, string> = {
  top: 'bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2',
  bottom: 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2'
}

export function Tooltip({ children, content, side = 'top' }: TooltipProps): React.JSX.Element {
  return (
    <span className="group/tooltip relative inline-grid place-items-center">
      {children}
      <span
        className={clsx(
          'pointer-events-none absolute z-50 whitespace-nowrap rounded bg-black/85 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-[0_8px_24px_rgba(0,0,0,0.32)] ring-1 ring-white/10 backdrop-blur transition delay-150 duration-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100',
          tooltipSideClass[side]
        )}
      >
        {content}
      </span>
    </span>
  )
}
