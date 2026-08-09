import { ipcMain } from 'electron'
import {
  createProfile,
  deleteProfile,
  getProfileDeleteSummary,
  listProfiles,
  updateProfile
} from '../services/profileService'

const channels = {
  list: 'profiles:list',
  create: 'profiles:create',
  update: 'profiles:update',
  getDeleteSummary: 'profiles:get-delete-summary',
  delete: 'profiles:delete'
} as const

export function registerProfileIpc(): void {
  ipcMain.handle(channels.list, listProfiles)
  ipcMain.handle(channels.create, (_event, payload) => createProfile(payload))
  ipcMain.handle(channels.update, (_event, payload) => updateProfile(payload))
  ipcMain.handle(channels.getDeleteSummary, (_event, profileId) =>
    getProfileDeleteSummary(profileId)
  )
  ipcMain.handle(channels.delete, (_event, profileId) => deleteProfile(profileId))
}
