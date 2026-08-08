import { mkdirSync } from 'node:fs'
import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'node:path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerMediaIpc } from './ipc/mediaIpc'
import { registerCollectionIpc } from './ipc/collectionIpc'
import { registerProfileIpc } from './ipc/profileIpc'
import { closeDatabase, initializeDatabase } from './database'
import { registerMediaProtocol, registerMediaProtocolPrivileges } from './media/mediaProtocol'
import { stopAllEmbeddedMpvSessions } from './media/embeddedMpv'
import icon from '../../resources/icon.png?asset'

registerMediaProtocolPrivileges()

function configureAppIdentity(): void {
  const appName = is.dev ? 'NexMP Dev' : 'NexMP'
  const userDataPath = is.dev
    ? join(process.cwd(), '.nexmp-dev')
    : join(app.getPath('appData'), appName)

  mkdirSync(userDataPath, { recursive: true })
  app.setName(appName)
  app.setPath('userData', userDataPath)
}

function shouldBlockBrowserShortcut(event: Electron.Input): boolean {
  const key = event.key.toLowerCase()
  const hasControlOrCommand = event.control || event.meta

  if (key === 'tab') return true

  if (event.alt && !hasControlOrCommand && key !== 'f4') return true

  if (!hasControlOrCommand) return false

  return (
    key === 'w' ||
    key === 'r' ||
    key === 'i' ||
    key === '0' ||
    key === '+' ||
    key === '=' ||
    key === '-' ||
    key === '_'
  )
}

function createSplashWindow(): { window: BrowserWindow; startedAt: number } {
  const splashWindow = new BrowserWindow({
    width: 360,
    height: 250,
    show: false,
    frame: false,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    backgroundColor: '#101114',
    icon,
    webPreferences: {
      sandbox: true
    }
  })

  splashWindow.setMenu(null)
  splashWindow.removeMenu()
  splashWindow.once('ready-to-show', () => splashWindow.show())
  splashWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        height: 100vh;
        overflow: hidden;
        display: grid;
        place-items: center;
        background:
          radial-gradient(circle at 50% 16%, rgba(0, 216, 130, 0.18), transparent 34%),
          #101114;
        color: #f4fff8;
        font-family: Inter, "Segoe UI", system-ui, sans-serif;
        user-select: none;
      }
      .shell {
        width: 100%;
        height: 100%;
        display: grid;
        place-items: center;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.015));
      }
      .stack {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 18px;
        animation: rise 420ms ease-out both;
      }
      .mark {
        position: relative;
        display: grid;
        width: 76px;
        height: 76px;
        place-items: center;
        border-radius: 20px;
        background: #00b875;
        color: #04120d;
        font-size: 38px;
        font-weight: 950;
        letter-spacing: -0.04em;
        box-shadow: 0 18px 44px rgba(0, 184, 117, 0.22);
      }
      .mark::after {
        content: "";
        position: absolute;
        inset: -6px;
        border-radius: 26px;
        border: 1px solid rgba(0, 216, 130, 0.34);
        animation: pulse 900ms ease-out infinite;
      }
      .brand {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 3px;
      }
      h1 {
        margin: 0;
        font-size: 26px;
        line-height: 1;
        font-weight: 900;
        letter-spacing: 0;
      }
      p {
        margin: 0;
        color: rgba(244, 255, 248, 0.64);
        font-size: 12px;
        font-weight: 700;
      }
      .bar {
        width: 168px;
        height: 3px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
      }
      .bar span {
        display: block;
        width: 42%;
        height: 100%;
        border-radius: inherit;
        background: #00d982;
        animation: slide 760ms ease-in-out infinite;
      }
      @keyframes rise {
        from { opacity: 0; transform: translateY(12px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes pulse {
        0% { opacity: 0.95; transform: scale(0.94); }
        100% { opacity: 0; transform: scale(1.24); }
      }
      @keyframes slide {
        0% { transform: translateX(-110%); }
        55%, 100% { transform: translateX(260%); }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="stack">
        <div class="mark">N</div>
        <div class="brand">
          <h1>NexMP</h1>
          <p>Preparing your library</p>
        </div>
        <div class="bar"><span></span></div>
      </section>
    </main>
  </body>
</html>`)}`
  )

  return { window: splashWindow, startedAt: Date.now() }
}

function createWindow(): void {
  const splash = createSplashWindow()
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.setMenu(null)
  mainWindow.removeMenu()

  mainWindow.on('ready-to-show', () => {
    const minimumSplashMs = 650
    const remainingSplashMs = Math.max(minimumSplashMs - (Date.now() - splash.startedAt), 0)

    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.show()
      }
      if (!splash.window.isDestroyed()) {
        splash.window.close()
      }
    }, remainingSplashMs)
  })

  mainWindow.on('closed', () => {
    if (!splash.window.isDestroyed()) {
      splash.window.close()
    }
  })

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (shouldBlockBrowserShortcut(input)) {
      event.preventDefault()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

configureAppIdentity()

app.whenReady().then(() => {
  electronApp.setAppUserModelId(is.dev ? 'com.nexmp.app.dev' : 'com.nexmp.app')
  Menu.setApplicationMenu(null)

  initializeDatabase()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerMediaIpc()
  registerCollectionIpc()
  registerProfileIpc()
  registerMediaProtocol()
  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  stopAllEmbeddedMpvSessions()
  closeDatabase()
})
