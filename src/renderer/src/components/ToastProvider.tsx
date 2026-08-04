import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
  ToastContext,
  type ToastApi,
  type ToastInput,
  type ToastMessage,
  type ToastMode
} from './toastContext'

type ToastProviderProps = {
  children: ReactNode
}

const toastStyles: Record<ToastMode, { border: string; background: string; accent: string }> = {
  success: {
    border: 'border-[#00b875]/35',
    background: 'bg-[#06251a]/95',
    accent: 'text-[#00d982]'
  },
  info: {
    border: 'border-[#72b7ff]/30',
    background: 'bg-[#0b1b2a]/95',
    accent: 'text-[#72b7ff]'
  },
  warning: {
    border: 'border-[#f5b84b]/35',
    background: 'bg-[#2b2110]/95',
    accent: 'text-[#f5c76d]'
  }
}

function createToastId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
}

export function ToastProvider({ children }: ToastProviderProps): React.JSX.Element {
  const [messages, setMessages] = useState<ToastMessage[]>([])

  const dismissToast = useCallback((toastId: string): void => {
    setMessages((currentMessages) => currentMessages.filter((message) => message.id !== toastId))
  }, [])

  const showToast = useCallback(
    ({ mode = 'info', title, description, durationMs = 3200 }: ToastInput): void => {
      const id = createToastId()
      setMessages((currentMessages) => [
        ...currentMessages.slice(-2),
        { id, mode, title, description }
      ])
      window.setTimeout(() => dismissToast(id), durationMs)
    },
    [dismissToast]
  )

  const api = useMemo<ToastApi>(
    () => ({
      showToast,
      success: (title, description) => showToast({ mode: 'success', title, description }),
      info: (title, description) => showToast({ mode: 'info', title, description }),
      warning: (title, description) => showToast({ mode: 'warning', title, description })
    }),
    [showToast]
  )

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed top-5 right-5 z-[90] flex w-[min(360px,calc(100vw-32px))] flex-col gap-2">
        {messages.map((message) => {
          const style = toastStyles[message.mode]

          return (
            <div
              key={message.id}
              className={`flex flex-col gap-1 rounded-xl border ${style.border} ${style.background} px-4 py-3 text-sm text-[#f4fff8] shadow-[0_18px_52px_rgba(0,0,0,0.45)] backdrop-blur-md`}
            >
              <p className={`text-xs font-black uppercase tracking-[0.18em] ${style.accent}`}>
                {message.mode}
              </p>
              <p className="font-bold">{message.title}</p>
              {message.description && (
                <p className="text-xs leading-relaxed text-[#a9c8bf]">{message.description}</p>
              )}
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}
