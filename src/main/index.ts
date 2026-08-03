import { app, shell, BrowserWindow, Menu } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerMediaIpc } from './ipc/mediaIpc'
import { closeDatabase, initializeDatabase } from './database'
import { registerMediaProtocol, registerMediaProtocolPrivileges } from './media/mediaProtocol'
import icon from '../../resources/icon.png?asset'

registerMediaProtocolPrivileges()

function shouldBlockBrowserShortcut(event: Electron.Input): boolean {
  const key = event.key.toLowerCase()
  const hasControlOrCommand = event.control || event.meta

  if (event.alt && !hasControlOrCommand && !event.shift) return true

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

function createWindow(): void {
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
    mainWindow.show()
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

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.nexmp.desktop')
  Menu.setApplicationMenu(null)

  initializeDatabase()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerMediaIpc()
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
  closeDatabase()
})
