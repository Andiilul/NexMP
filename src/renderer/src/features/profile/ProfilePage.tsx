import { Check, Plus, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../../../../shared/types/profile'

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
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [name, setName] = useState('')
  const [avatarColor, setAvatarColor] = useState(avatarColors[0])
  const [isCreating, setIsCreating] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const loadProfiles = async (): Promise<void> => {
      try {
        const profileApi = window.api?.profiles
        if (!profileApi) throw new Error('Profile service is unavailable. Please restart NexMP.')

        setProfiles(await profileApi.list())
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load profiles.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfiles()
  }, [])

  useEffect(() => {
    if (isCreateDialogOpen) nameInputRef.current?.focus()
  }, [isCreateDialogOpen])

  const selectProfile = (profile: Profile): void => {
    sessionStorage.setItem('nexmp.active-profile-id', profile.id)
    navigate('/home')
  }

  const openCreateDialog = (): void => {
    setError(null)
    setIsCreateDialogOpen(true)
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
      setName('')
      setIsCreateDialogOpen(false)
      selectProfile(profile)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create profile.')
    } finally {
      setIsCreating(false)
    }
  }

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
              <button
                key={profile.id}
                className="group flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center transition hover:-translate-y-0.5 hover:border-[#00b875]/70 hover:bg-[#00b875]/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00d982]"
                type="button"
                onClick={() => selectProfile(profile)}
              >
                <span
                  className="grid h-20 w-20 place-items-center rounded-full text-2xl font-bold text-white shadow-inner"
                  style={{ backgroundColor: profile.avatarColor }}
                >
                  {initials(profile.name)}
                </span>
                <span className="block truncate font-semibold text-[#f4fff8]">{profile.name}</span>
              </button>
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
        {error && !isCreateDialogOpen && (
          <p className="text-center text-sm text-[#ffaaa0]">{error}</p>
        )}
      </section>

      {isCreateDialogOpen && (
        <div
          className="fixed inset-0 z-20 grid place-items-center bg-black/65 p-6"
          role="presentation"
          onMouseDown={() => !isCreating && setIsCreateDialogOpen(false)}
        >
          <form
            className="flex w-full max-w-[520px] flex-col gap-5 rounded-2xl border border-white/10 bg-[#17191e] p-7 shadow-[0_24px_80px_rgba(0,0,0,0.5)]"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={(event) => void createProfile(event)}
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-bold text-[#f4fff8]">Create profile</h2>
              <p className="text-sm text-[#a9c8bf]">Give this profile a name and color.</p>
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
                onClick={() => setIsCreateDialogOpen(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#00b875] px-5 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-50"
                type="submit"
                disabled={!name.trim() || isCreating}
              >
                {isCreating ? 'Creating...' : 'Create profile'}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  )
}
