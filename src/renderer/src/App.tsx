import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom'
import { HomePage } from './features/home/HomePage'
import { HomeLayout } from './features/home/HomeLayout'
import { ContinueWatchingPage } from './features/home/ContinueWatchingPage'
import { SettingsPage } from './features/home/SettingsPage'
import { CollectionFormPage } from './features/collections/CollectionFormPage'
import { CollectionDetailPage } from './features/collections/CollectionDetailPage'
import { CollectionSourcePage } from './features/collections/CollectionSourcePage'
import { SearchPage } from './features/search/SearchPage'
import { PlayerPage } from './features/player/PlayerPage'
import { ProfilePage } from './features/profile/ProfilePage'

function App(): React.JSX.Element {
  return (
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
          <Route path="search" element={<SearchPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/player" element={<PlayerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </MemoryRouter>
  )
}

export default App
