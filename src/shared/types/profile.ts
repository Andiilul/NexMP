export type Profile = {
  id: string
  name: string
  avatarColor: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export type CreateProfileInput = {
  name: string
  avatarColor: string
}

export type ProfileApi = {
  list: () => Promise<Profile[]>
  create: (input: CreateProfileInput) => Promise<Profile>
}
