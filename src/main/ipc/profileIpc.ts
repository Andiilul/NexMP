import { ipcMain } from 'electron'
import { createProfile, listProfiles, updateProfile } from '../services/profileService'

const channels = {
  list: 'profiles:list',
  create: 'profiles:create',
  update: 'profiles:update'
} as const

export function registerProfileIpc(): void {
  ipcMain.handle(channels.list, listProfiles)
  ipcMain.handle(channels.create, (_event, payload) => createProfile(payload))
  ipcMain.handle(channels.update, (_event, payload) => updateProfile(payload))
}
