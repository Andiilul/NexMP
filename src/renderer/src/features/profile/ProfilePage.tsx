import { Check, Pencil, Plus, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../../../../shared/types/profile'
import { useAppState } from '../../components/useAppState'

const avatarColors = ['#00b875', '#3b82f6', '#a855f7', '#f97316', '#ef4444', '#eab308']

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

export function ProfilePage(): React.JSX.Element {
  const navigate = useNavigate()
  const {
    appState: { login },
    setLoginProfile,
    clearLoginProfile
  } = useAppState()
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [name, setName] = useState('')
  const [avatarColor, setAvatarColor] = useState(avatarColors[0])
  const [isCreating, setIsCreating] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProfiles = async (): Promise<void> => {
      try {
        const profileApi = window.api?.profiles
        if (!profileApi) throw new Error('Profile service is unavailable. Please restart NexMP.')

        const nextProfiles = await profileApi.list()
        setProfiles(nextProfiles)

        if (login) {
          const activeProfile = nextProfiles.find((profile) => profile.id === login.id) ?? null
          if (activeProfile) {
            setLoginProfile(activeProfile)
            navigate('/home', { replace: true })
            return
          }

          clearLoginProfile()
        }
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load profiles.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfiles()
  }, [clearLoginProfile, login, navigate, setLoginProfile])

  useEffect(() => {
    if (isCreateDialogOpen || editingProfile) nameInputRef.current?.focus()
  }, [editingProfile, isCreateDialogOpen])

  const selectProfile = (profile: Profile): void => {
    setLoginProfile(profile)
    navigate('/home')
  }

  const openCreateDialog = (): void => {
    setError(null)
    setName('')
    setAvatarColor(avatarColors[0])
    setIsCreateDialogOpen(true)
  }

  const openEditDialog = (profile: Profile): void => {
    setError(null)
    setName(profile.name)
    setAvatarColor(profile.avatarColor)
    setEditingProfile(profile)
  }

  const closeProfileDialog = (): void => {
    if (isCreating || isUpdating) return

    setIsCreateDialogOpen(false)
    setEditingProfile(null)
    setName('')
    setAvatarColor(avatarColors[0])
    setError(null)
  }

  const createProfile = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!name.trim() || isCreating) return

    try {
      setIsCreating(true)
      setError(null)
      const profileApi = window.api?.profiles
      if (!profileApi) throw new Error('Profile service is unavailable. Please restart NexMP.')

      const profile = await profileApi.create({ name, avatarColor })
      setProfiles((current) => [...current, profile])
      setIsCreateDialogOpen(false)
      setName('')
      setAvatarColor(avatarColors[0])
      setError(null)
      selectProfile(profile)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create profile.')
    } finally {
      setIsCreating(false)
    }
  }

  const updateProfile = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!editingProfile || !name.trim() || isUpdating) return

    try {
      setIsUpdating(true)
      setError(null)
      const profileApi = window.api?.profiles
      if (!profileApi) throw new Error('Profile service is unavailable. Please restart NexMP.')

      const profile = await profileApi.update({
        id: editingProfile.id,
        name,
        avatarColor
      })
      setProfiles((current) => current.map((item) => (item.id === profile.id ? profile : item)))
      if (login?.id === profile.id) {
        setLoginProfile(profile)
      }
      window.dispatchEvent(new CustomEvent('nexmp:profile-updated', { detail: profile }))
      setEditingProfile(null)
      setName('')
      setAvatarColor(avatarColors[0])
      setError(null)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to update profile.')
    } finally {
      setIsUpdating(false)
    }
  }

  const isProfileDialogOpen = isCreateDialogOpen || editingProfile !== null
  const isSavingProfile = isCreating || isUpdating

  return (
    <main className="grid min-h-screen place-items-center overflow-auto bg-[#101114] p-8">
      <section className="flex w-full max-w-[760px] flex-col gap-9 rounded-2xl border border-white/10 bg-[#17191e] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-12">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[#00b875] text-[#04120d]">
            <UserRound size={28} />
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-[#f4fff8]">Who’s watching?</h1>
            <p className="text-[#a9c8bf]">Select a profile to continue to NexMP.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="py-10 text-center text-[#a9c8bf]">Loading profiles...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="group relative rounded-xl border border-white/10 bg-white/[0.03] transition hover:-translate-y-0.5 hover:border-[#00b875]/70 hover:bg-[#00b875]/10"
              >
                <button
                  className="flex w-full flex-col items-center gap-3 rounded-xl p-4 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d982]"
                  type="button"
                  onClick={() => selectProfile(profile)}
                >
                  <span
                    className="grid h-20 w-20 place-items-center rounded-full text-2xl font-bold text-white shadow-inner"
                    style={{ backgroundColor: profile.avatarColor }}
                  >
                    {initials(profile.name)}
                  </span>
                  <span className="block max-w-full truncate font-semibold text-[#f4fff8]">
                    {profile.name}
                  </span>
                </button>
                <button
                  className="absolute right-2 top-2 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-[#101114]/90 text-[#a9c8bf] opacity-100 transition hover:border-[#00b875]/70 hover:text-[#f4fff8] sm:opacity-0 sm:group-hover:opacity-100"
                  type="button"
                  aria-label={`Edit ${profile.name}`}
                  onClick={() => openEditDialog(profile)}
                >
                  <Pencil size={16} />
                </button>
              </div>
            ))}
            <button
              className="group flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/20 p-4 text-center text-[#a9c8bf] transition hover:border-[#00b875]/70 hover:bg-[#00b875]/10 hover:text-[#f4fff8] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d982]"
              type="button"
              onClick={openCreateDialog}
            >
              <span className="grid h-20 w-20 place-items-center rounded-full bg-white/5 transition group-hover:bg-[#00b875] group-hover:text-[#04120d]">
                <Plus size={30} />
              </span>
              <span className="block font-semibold">Add profile</span>
            </button>
          </div>
        )}
        {error && !isProfileDialogOpen && (
          <p className="text-center text-sm text-[#ffaaa0]">{error}</p>
        )}
      </section>

      {isProfileDialogOpen && (
        <div
          className="fixed inset-0 z-20 grid place-items-center bg-black/65 p-6"
          role="presentation"
          onMouseDown={closeProfileDialog}
        >
          <form
            className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-white/10 bg-[#17191e] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) =>
              editingProfile ? void updateProfile(event) : void createProfile(event)
            }
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-[#f4fff8]">
                {editingProfile ? 'Edit profile' : 'Create profile'}
              </h2>
              <p className="text-sm text-[#a9c8bf]">
                {editingProfile
                  ? 'Update this profile name and color.'
                  : 'Give this profile a name and color.'}
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <label className="block text-sm font-semibold text-[#f4fff8]" htmlFor="profile-name">
                Profile name
              </label>
              <input
                id="profile-name"
                ref={nameInputRef}
                className="w-full rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-[#f4fff8] outline-none placeholder:text-white/35 focus:border-[#00b875]"
                maxLength={32}
                placeholder="e.g. Alex"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-[#f4fff8]">Profile color</p>
              <div className="flex items-center gap-3">
                {avatarColors.map((color) => (
                  <button
                    key={color}
                    className="grid h-8 w-8 place-items-center rounded-full ring-offset-2 ring-offset-[#17191e]"
                    style={{
                      backgroundColor: color,
                      outline: avatarColor === color ? '2px solid white' : undefined
                    }}
                    type="button"
                    aria-label={`Select ${color}`}
                    onClick={() => setAvatarColor(color)}
                  >
                    {avatarColor === color && <Check size={15} />}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-[#ffaaa0]">{error}</p>}
            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={closeProfileDialog}
                disabled={isSavingProfile}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-5 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-50"
                type="submit"
                disabled={!name.trim() || isSavingProfile}
              >
                {isUpdating
                  ? 'Saving...'
                  : isCreating
                    ? 'Creating...'
                    : editingProfile
                      ? 'Save profile'
                      : 'Create profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
