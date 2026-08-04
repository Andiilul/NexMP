import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AppStateContext,
  defaultAppState,
  type AppState,
  type AppStateApi
} from './appStateContext'

type AppStateProviderProps = {
  children: ReactNode
}

const APP_STATE_STORAGE_KEY = 'nexmp.app-state'

type StoredAppState = Partial<AppState> & {
  pin_on_top?: boolean
}

function readStoredAppState(): AppState {
  try {
    const storedValue = window.localStorage.getItem(APP_STATE_STORAGE_KEY)
    if (!storedValue) return defaultAppState

    const parsedValue = JSON.parse(storedValue) as StoredAppState
    return {
      ...defaultAppState,
      pinOnTop:
        typeof parsedValue.pinOnTop === 'boolean'
          ? parsedValue.pinOnTop
          : typeof parsedValue.pin_on_top === 'boolean'
            ? parsedValue.pin_on_top
            : defaultAppState.pinOnTop
    }
  } catch {
    return defaultAppState
  }
}

export function AppStateProvider({ children }: AppStateProviderProps): React.JSX.Element {
  const [appState, setAppState] = useState<AppState>(() => readStoredAppState())

  useEffect(() => {
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({ pin_on_top: appState.pinOnTop })
    )
  }, [appState])

  const setPinOnTop = useCallback((pinOnTop: boolean): void => {
    setAppState((currentState) => ({ ...currentState, pinOnTop }))
  }, [])

  const togglePinOnTop = useCallback((): void => {
    setAppState((currentState) => ({ ...currentState, pinOnTop: !currentState.pinOnTop }))
  }, [])

  const api = useMemo<AppStateApi>(
    () => ({
      appState,
      setPinOnTop,
      togglePinOnTop
    }),
    [appState, setPinOnTop, togglePinOnTop]
  )

  return <AppStateContext.Provider value={api}>{children}</AppStateContext.Provider>
}
