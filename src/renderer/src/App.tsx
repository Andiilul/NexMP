import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { PlayerPage } from './features/player/PlayerPage'

function App(): React.JSX.Element {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<PlayerPage />} />
      </Routes>
    </MemoryRouter>
  )
}

export default App
