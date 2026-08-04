import { X } from 'lucide-react'
import type { ReactNode } from 'react'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

type ModalProps = {
  isOpen: boolean
  title: string
  children: ReactNode
  onClose: () => void
  size?: ModalSize
  className?: string
  closeLabel?: string
}

const modalSizeClassName: Record<ModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-5xl'
}

export function Modal({
  isOpen,
  title,
  children,
  onClose,
  size = 'md',
  className = '',
  closeLabel = 'Close modal'
}: ModalProps): React.JSX.Element | null {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4">
      <div
        className={`w-full rounded-xl border border-white/10 bg-[#171a1f] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.48)] ${modalSizeClassName[size]} ${className}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-4">
          <h2 className="text-lg font-bold">{title}</h2>
          <button
            className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]"
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
