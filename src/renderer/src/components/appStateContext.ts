import type { PlayerEngine } from '../../../shared/types/media'
import type { Profile } from '../../../shared/types/profile'
import { createContext } from 'react'

export type HomeSortBy = 'date' | 'name' | 'rating'

export type AppState = {
  pinOnTop: boolean
  homeCollectionTileSizeIndex: number
  homeSortBy: HomeSortBy
  playerEngine: PlayerEngine
  login: Profile | null
}

export type AppStateApi = {
  appState: AppState
  setPinOnTop: (pinOnTop: boolean) => void
  togglePinOnTop: () => void
  setHomeCollectionTileSizeIndex: (tileSizeIndex: number) => void
  setHomeSortBy: (sortBy: HomeSortBy) => void
  setPlayerEngine: (playerEngine: PlayerEngine) => void
  setLoginProfile: (profile: Profile) => void
  clearLoginProfile: () => void
}

export const defaultAppState: AppState = {
  pinOnTop: true,
  homeCollectionTileSizeIndex: 1,
  homeSortBy: 'date',
  playerEngine: 'html',
  login: null
}

export const AppStateContext = createContext<AppStateApi | null>(null)
