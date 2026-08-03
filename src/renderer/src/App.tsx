import { FolderKanban, Link2, Play } from 'lucide-react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

function SetupPage(): React.JSX.Element {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <div className="app-mark">
          <Play size={28} fill="currentColor" />
        </div>

        <div className="setup-content">
          <span className="eyebrow">NexMP Desktop</span>

          <h1>Development environment is ready.</h1>

          <p className="description">A connected local media manager and player for Windows.</p>

          <div className="feature-list">
            <div className="feature-item">
              <FolderKanban size={20} />
              <div>
                <strong>Local media management</strong>
                <span>Organize media folders from different drives.</span>
              </div>
            </div>

            <div className="feature-item">
              <Link2 size={20} />
              <div>
                <strong>Connected folders</strong>
                <span>Display separate folder paths in one environment.</span>
              </div>
            </div>

            <div className="feature-item">
              <Play size={20} />
              <div>
                <strong>Integrated playback</strong>
                <span>Playback support will be implemented later.</span>
              </div>
            </div>
          </div>

          <div className="status">
            <span className="status-indicator" />
            Electron, React, TypeScript, and Vite are running.
          </div>
        </div>
      </section>
    </main>
  )
}

function App(): React.JSX.Element {
  return (
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<SetupPage />} />
      </Routes>
    </MemoryRouter>
  )
}

export default App
