import { useContext } from 'react'
import { AppStateContext, type AppStateApi } from './appStateContext'

export function useAppState(): AppStateApi {
  const appState = useContext(AppStateContext)
  if (!appState) throw new Error('useAppState must be used within AppStateProvider.')
  return appState
}
