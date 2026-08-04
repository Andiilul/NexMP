import { randomUUID } from 'node:crypto'
import { asc, eq } from 'drizzle-orm'
import type { CreateProfileInput, Profile, UpdateProfileInput } from '../../shared/types/profile'
import { getDatabase } from '../database'
import { profiles } from '../database/schema'

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ')
}

export function listProfiles(): Profile[] {
  return getDatabase().select().from(profiles).orderBy(asc(profiles.createdAt)).all()
}

export function createProfile(input: CreateProfileInput): Profile {
  const name = normalizeName(input.name ?? '')
  const avatarColor = input.avatarColor?.trim()

  if (!name) throw new Error('Profile name is required.')
  if (name.length > 32) throw new Error('Profile name can be at most 32 characters.')
  if (!avatarColor || !/^#[0-9a-fA-F]{6}$/.test(avatarColor)) {
    throw new Error('A valid avatar color is required.')
  }

  const database = getDatabase()
  const isFirstProfile = listProfiles().length === 0
  const id = randomUUID()

  database.insert(profiles).values({ id, name, avatarColor, isDefault: isFirstProfile }).run()

  const profile = database.select().from(profiles).where(eq(profiles.id, id)).get()
  if (!profile) throw new Error('Could not create profile.')

  return profile
}

export function updateProfile(input: UpdateProfileInput): Profile {
  const name = normalizeName(input.name ?? '')
  if (!name) throw new Error('Profile name is required.')
  if (name.length > 32) throw new Error('Profile name can be at most 32 characters.')

  const database = getDatabase()
  const existingProfile = database.select().from(profiles).where(eq(profiles.id, input.id)).get()
  if (!existingProfile) throw new Error('Profile not found.')

  database
    .update(profiles)
    .set({ name, updatedAt: new Date().toISOString() })
    .where(eq(profiles.id, input.id))
    .run()

  const profile = database.select().from(profiles).where(eq(profiles.id, input.id)).get()
  if (!profile) throw new Error('Could not update profile.')

  return profile
}
