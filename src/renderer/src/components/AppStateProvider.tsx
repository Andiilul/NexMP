import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AppStateContext,
  defaultAppState,
  type AppState,
  type AppStateApi,
  type HomeSortBy
} from './appStateContext'
import type { PlayerEngine } from '../../../shared/types/media'
import type { Profile } from '../../../shared/types/profile'

type AppStateProviderProps = {
  children: ReactNode
}

const APP_STATE_STORAGE_KEY = 'nexmp.app-state'
const APP_STATE_VERSION = 2

type StoredAppState = Partial<AppState> & {
  version?: number
  pin_on_top?: boolean
  home_collection_tile_size_index?: number
  home_sort_by?: HomeSortBy
  player_engine?: PlayerEngine
  active_profile?: Profile | null
}

function normalizeTileSizeIndex(value: unknown): number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
    ? value
    : defaultAppState.homeCollectionTileSizeIndex
}

function normalizeHomeSortBy(value: unknown): HomeSortBy {
  return value === 'date' || value === 'name' || value === 'rating'
    ? value
    : defaultAppState.homeSortBy
}

function normalizeLogin(value: unknown): Profile | null {
  if (!value || typeof value !== 'object') return null

  const profile = value as Partial<Profile>
  if (
    typeof profile.id !== 'string' ||
    typeof profile.name !== 'string' ||
    typeof profile.avatarColor !== 'string'
  ) {
    return null
  }

  return {
    id: profile.id,
    name: profile.name,
    avatarColor: profile.avatarColor,
    isDefault: Boolean(profile.isDefault),
    createdAt: typeof profile.createdAt === 'string' ? profile.createdAt : '',
    updatedAt: typeof profile.updatedAt === 'string' ? profile.updatedAt : ''
  }
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
            : defaultAppState.pinOnTop,
      homeCollectionTileSizeIndex: normalizeTileSizeIndex(
        parsedValue.homeCollectionTileSizeIndex ?? parsedValue.home_collection_tile_size_index
      ),
      homeSortBy: normalizeHomeSortBy(parsedValue.homeSortBy ?? parsedValue.home_sort_by),
      playerEngine:
        parsedValue.version === APP_STATE_VERSION &&
        (parsedValue.playerEngine === 'mpv' || parsedValue.player_engine === 'mpv')
          ? 'mpv'
          : 'html',
      login: normalizeLogin(parsedValue.login ?? parsedValue.active_profile)
    }
  } catch {
    return defaultAppState
  }
}

export function AppStateProvider({ children }: AppStateProviderProps): React.JSX.Element {
  const [appState, setAppState] = useState<AppState>(() => readStoredAppState())

  useEffect(() => {
    if (appState.login) {
      sessionStorage.setItem('nexmp.active-profile-id', appState.login.id)
      return
    }

    sessionStorage.removeItem('nexmp.active-profile-id')
  }, [appState.login])

  useEffect(() => {
    window.localStorage.setItem(
      APP_STATE_STORAGE_KEY,
      JSON.stringify({
        version: APP_STATE_VERSION,
        pin_on_top: appState.pinOnTop,
        home_collection_tile_size_index: appState.homeCollectionTileSizeIndex,
        home_sort_by: appState.homeSortBy,
        player_engine: appState.playerEngine,
        active_profile: appState.login
      })
    )
  }, [appState])

  const setPinOnTop = useCallback((pinOnTop: boolean): void => {
    setAppState((currentState) => ({ ...currentState, pinOnTop }))
  }, [])

  const togglePinOnTop = useCallback((): void => {
    setAppState((currentState) => ({ ...currentState, pinOnTop: !currentState.pinOnTop }))
  }, [])

  const setHomeCollectionTileSizeIndex = useCallback((tileSizeIndex: number): void => {
    setAppState((currentState) => ({
      ...currentState,
      homeCollectionTileSizeIndex: tileSizeIndex
    }))
  }, [])

  const setHomeSortBy = useCallback((homeSortBy: HomeSortBy): void => {
    setAppState((currentState) => ({ ...currentState, homeSortBy }))
  }, [])

  const setPlayerEngine = useCallback((playerEngine: PlayerEngine): void => {
    setAppState((currentState) => ({ ...currentState, playerEngine }))
  }, [])

  const setLoginProfile = useCallback((profile: Profile): void => {
    sessionStorage.setItem('nexmp.active-profile-id', profile.id)
    setAppState((currentState) => ({ ...currentState, login: profile }))
  }, [])

  const clearLoginProfile = useCallback((): void => {
    sessionStorage.removeItem('nexmp.active-profile-id')
    setAppState((currentState) => ({ ...currentState, login: null }))
  }, [])

  const api = useMemo<AppStateApi>(
    () => ({
      appState,
      setPinOnTop,
      togglePinOnTop,
      setHomeCollectionTileSizeIndex,
      setHomeSortBy,
      setPlayerEngine,
      setLoginProfile,
      clearLoginProfile
    }),
    [
      appState,
      setPinOnTop,
      togglePinOnTop,
      setHomeCollectionTileSizeIndex,
      setHomeSortBy,
      setPlayerEngine,
      setLoginProfile,
      clearLoginProfile
    ]
  )

  return <AppStateContext.Provider value={api}>{children}</AppStateContext.Provider>
}
