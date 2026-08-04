import { createContext } from 'react'

export type ToastMode = 'success' | 'info' | 'warning'

export type ToastInput = {
  mode?: ToastMode
  title: string
  description?: string
  durationMs?: number
}

export type ToastApi = {
  showToast: (toast: ToastInput) => void
  success: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
}

export type ToastMessage = Required<Pick<ToastInput, 'mode' | 'title'>> &
  Pick<ToastInput, 'description'> & {
    id: string
  }

export const ToastContext = createContext<ToastApi | null>(null)
