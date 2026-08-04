import { ipcMain } from 'electron'
import { createProfile, listProfiles } from '../services/profileService'

const channels = {
  list: 'profiles:list',
  create: 'profiles:create'
} as const

export function registerProfileIpc(): void {
  ipcMain.handle(channels.list, listProfiles)
  ipcMain.handle(channels.create, (_event, payload) => createProfile(payload))
}
