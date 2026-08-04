import { Check, Settings, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile } from '../../../../shared/types/profile'
import { useToast } from '../../components/useToast'

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

export function SettingsPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { success, warning } = useToast()
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [profileName, setProfileName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const activeProfileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!activeProfileId) {
      navigate('/')
      return
    }

    const loadProfile = async (): Promise<void> => {
      try {
        setError(null)
        const profiles = await window.api?.profiles.list()
        const profile = profiles?.find((item) => item.id === activeProfileId) ?? null
        if (!profile) throw new Error('The active profile no longer exists.')

        setActiveProfile(profile)
        setProfileName(profile.name)
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to load profile settings.')
      } finally {
        setIsLoading(false)
      }
    }

    void loadProfile()
  }, [navigate])

  const saveProfileName = async (): Promise<void> => {
    if (!activeProfile) return

    try {
      setIsSaving(true)
      setError(null)
      const profile = await window.api?.profiles.update({
        id: activeProfile.id,
        name: profileName
      })
      if (!profile) throw new Error('Unable to update profile.')

      setActiveProfile(profile)
      setProfileName(profile.name)
      window.dispatchEvent(new CustomEvent('nexmp:profile-updated', { detail: profile }))
      success('Profile updated.')
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to update profile.'
      setError(message)
      warning(message)
    } finally {
      setIsSaving(false)
    }
  }

  const hasProfileNameChanged = profileName.trim() !== (activeProfile?.name ?? '')

  return (
    <div className="flex w-full max-w-3xl flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[#00d982]">SETTINGS</p>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>

      <section className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#00b875]/10 text-[#00d982]">
            <Settings size={22} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-bold">Library profile</h2>
            <p className="text-sm text-[#a9c8bf]">Edit the current library/profile name.</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-[#a9c8bf]">Loading profile...</p>
        ) : (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d0f12]/70 p-4">
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#176b61] text-sm font-black text-white"
                style={activeProfile ? { backgroundColor: activeProfile.avatarColor } : undefined}
              >
                {activeProfile ? getInitials(activeProfile.name) : <UserRound size={20} />}
              </span>
              <label className="flex min-w-0 flex-1 flex-col gap-2" htmlFor="profile-name">
                <span className="text-sm font-semibold text-[#f4fff8]">Profile name</span>
                <input
                  id="profile-name"
                  className="w-full rounded-lg border border-white/15 bg-[#171a1f] px-4 py-3 text-[#f4fff8] outline-none placeholder:text-white/35 focus:border-[#00b875]"
                  value={profileName}
                  onChange={(event) => setProfileName(event.target.value)}
                  maxLength={32}
                  placeholder="Profile name"
                />
              </label>
            </div>

            {error && <p className="text-sm text-[#ffaaa0]">{error}</p>}

            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg border border-white/15 px-4 py-2.5 font-semibold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={() => setProfileName(activeProfile?.name ?? '')}
                disabled={!hasProfileNameChanged || isSaving}
              >
                Reset
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
                type="button"
                onClick={() => void saveProfileName()}
                disabled={!profileName.trim() || !hasProfileNameChanged || isSaving}
              >
                <Check size={18} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
