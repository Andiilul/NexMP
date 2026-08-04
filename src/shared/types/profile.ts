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

export type UpdateProfileInput = {
  id: string
  name: string
}

export type ProfileApi = {
  list: () => Promise<Profile[]>
  create: (input: CreateProfileInput) => Promise<Profile>
  update: (input: UpdateProfileInput) => Promise<Profile>
}
