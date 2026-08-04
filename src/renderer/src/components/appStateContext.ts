import { createContext } from 'react'

export type AppState = {
  pinOnTop: boolean
}

export type AppStateApi = {
  appState: AppState
  setPinOnTop: (pinOnTop: boolean) => void
  togglePinOnTop: () => void
}

export const defaultAppState: AppState = {
  pinOnTop: true
}

export const AppStateContext = createContext<AppStateApi | null>(null)
