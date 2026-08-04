import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect } from 'react'
import { HomePage } from './features/home/HomePage'
import { HomeLayout } from './features/home/HomeLayout'
import { ContinueWatchingPage } from './features/home/ContinueWatchingPage'
import { SettingsPage } from './features/home/SettingsPage'
import { CollectionFormPage } from './features/collections/CollectionFormPage'
import { CollectionDetailPage } from './features/collections/CollectionDetailPage'
import { CollectionSourcePage } from './features/collections/CollectionSourcePage'
import { PlayerPage } from './features/player/PlayerPage'
import { ProfilePage } from './features/profile/ProfilePage'
import { ToastProvider } from './components/ToastProvider'
import { TagsPage } from './features/tags/TagsPage'
import { AppStateProvider } from './components/AppStateProvider'

function GlobalKeyboardShortcuts(): null {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const isFindShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f'
      if (!isFindShortcut || event.altKey) return

      event.preventDefault()
      const searchTarget = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        '[data-nexmp-search-target="true"]:not(:disabled)'
      )
      searchTarget?.focus()
      searchTarget?.select()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return null
}

function App(): React.JSX.Element {
  return (
    <AppStateProvider>
      <ToastProvider>
        <GlobalKeyboardShortcuts />
        <MemoryRouter>
          <Routes>
            <Route path="/" element={<ProfilePage />} />
            <Route path="/home" element={<HomeLayout />}>
              <Route index element={<HomePage />} />
              <Route path="collections" element={<Navigate to="/home" replace />} />
              <Route path="collections/new" element={<CollectionFormPage />} />
              <Route path="collections/:collectionId" element={<CollectionDetailPage />} />
              <Route
                path="collections/:collectionId/sources/:sourceId"
                element={<CollectionSourcePage />}
              />
              <Route path="continue" element={<ContinueWatchingPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="/player" element={<PlayerPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MemoryRouter>
      </ToastProvider>
    </AppStateProvider>
  )
}

export default App
