import { useContext } from 'react'
import { ToastContext, type ToastApi } from './toastContext'

export function useToast(): ToastApi {
  const toast = useContext(ToastContext)
  if (!toast) throw new Error('useToast must be used within ToastProvider.')

  return toast
}
