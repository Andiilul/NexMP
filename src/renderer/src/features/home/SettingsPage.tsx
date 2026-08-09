import { AlertTriangle, Check, Settings, Trash2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Profile, ProfileDeleteSummary } from '../../../../shared/types/profile'
import type { PlayerEngine } from '../../../../shared/types/media'
import { useAppState } from '../../components/useAppState'
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
  const { appState, setPlayerEngine, setLoginProfile, clearLoginProfile } = useAppState()
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [profileName, setProfileName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteSummary, setDeleteSummary] = useState<ProfileDeleteSummary | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
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
      if (appState.login?.id === profile.id) {
        setLoginProfile(profile)
      }
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

  const openDeleteDialog = async (): Promise<void> => {
    if (!activeProfile) return

    try {
      setError(null)
      setDeleteConfirmation('')
      const summary = await window.api?.profiles.getDeleteSummary(activeProfile.id)
      if (!summary) throw new Error('Unable to prepare profile deletion.')
      setDeleteSummary(summary)
      setIsDeleteDialogOpen(true)
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to prepare deletion.'
      setError(message)
      warning(message)
    }
  }

  const closeDeleteDialog = (): void => {
    if (isDeleting) return

    setIsDeleteDialogOpen(false)
    setDeleteSummary(null)
    setDeleteConfirmation('')
  }

  const deleteProfile = async (): Promise<void> => {
    if (!activeProfile || !deleteSummary || deleteConfirmation !== deletePhrase) return

    try {
      setIsDeleting(true)
      setError(null)
      await window.api?.profiles.delete(activeProfile.id)
      clearLoginProfile()
      window.dispatchEvent(new CustomEvent('nexmp:profile-deleted', { detail: activeProfile }))
      success('Library deleted.')
      navigate('/', { replace: true })
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Unable to delete library.'
      setError(message)
      warning(message)
    } finally {
      setIsDeleting(false)
    }
  }

  const hasProfileNameChanged = profileName.trim() !== (activeProfile?.name ?? '')
  const deletePhrase = activeProfile ? `DELETE ${activeProfile.name}` : ''
  const canDeleteProfile =
    Boolean(activeProfile && deleteSummary) && deleteConfirmation === deletePhrase && !isDeleting
  const engineOptions: Array<{
    value: PlayerEngine
    title: string
    badge?: string
    description: string
  }> = [
    {
      value: 'html',
      title: 'HTML engine',
      badge: 'Default',
      description: 'Main NexMP player for every format. Uses clean text subtitles for MKV softsubs.'
    },
    {
      value: 'mpv',
      title: 'MPV engine',
      badge: 'Beta',
      description:
        'Experimental native mpv renderer inside NexMP. Use only when HTML playback needs a fallback.'
    }
  ]

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

      <section className="flex flex-col gap-5 rounded-2xl border border-[#ff6f60]/25 bg-[#3e1c1f]/25 p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#ff6f60]/15 text-[#ffaaa0]">
            <AlertTriangle size={22} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-bold">
              {' '}
              Delete this library profile and all data stored under it.
            </h2>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#ff6f60]/25 bg-[#171a1f]/80 p-4">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="font-bold text-[#f4fff8]">Delete library profile</p>
            <p className="text-sm text-[#a9c8bf]">
              This removes the selected library, collections, tags, progress, and video rows.
            </p>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#220806] transition hover:bg-[#ff8a7e] disabled:opacity-60"
            type="button"
            onClick={() => void openDeleteDialog()}
            disabled={!activeProfile || isLoading || isDeleting}
          >
            <Trash2 size={18} />
            Delete Library
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#00b875]/10 text-[#00d982]">
            <Settings size={22} />
          </span>
          <div className="flex flex-col gap-1">
            <h2 className="font-bold">Player engine</h2>
            <p className="text-sm text-[#a9c8bf]">Choose how NexMP renders video playback.</p>
          </div>
        </div>

        <div className="grid gap-3">
          {engineOptions.map((option) => {
            const isSelected = appState.playerEngine === option.value

            return (
              <button
                key={option.value}
                className={`flex items-start justify-between gap-4 rounded-xl border p-4 text-left transition ${
                  isSelected
                    ? 'border-[#00b875]/70 bg-[#00b875]/10'
                    : 'border-white/10 bg-[#0d0f12]/70 hover:border-white/20 hover:bg-white/[0.05]'
                }`}
                type="button"
                onClick={() => {
                  setPlayerEngine(option.value)
                  success(`Player engine set to ${option.title}.`)
                }}
              >
                <span className="flex flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#f4fff8]">{option.title}</span>
                    {option.badge && (
                      <span className="rounded-md border border-[#00d982]/30 bg-[#00b875]/10 px-2 py-0.5 text-[11px] leading-4 font-bold uppercase tracking-wide text-[#00d982]">
                        {option.badge}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-[#a9c8bf]">{option.description}</span>
                </span>
                {isSelected && <Check size={20} className="mt-0.5 shrink-0 text-[#00d982]" />}
              </button>
            )
          })}
        </div>
      </section>

      {isDeleteDialogOpen && activeProfile && deleteSummary && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 px-4"
          role="presentation"
          onMouseDown={closeDeleteDialog}
        >
          <div
            className="flex w-full max-w-lg flex-col gap-5 rounded-2xl border border-[#ff6f60]/30 bg-[#17191e] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#ff6f60]/15 text-[#ffaaa0]">
                <AlertTriangle size={22} />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-xl font-bold text-[#f4fff8]">Delete this library?</h2>
                <p className="text-sm text-[#a9c8bf]">
                  Anda akan menghapus library ini. Tindakan ini permanen dan tidak bisa dibatalkan.
                </p>
              </div>
            </div>

            <div className="grid gap-2 rounded-xl border border-white/10 bg-[#0d0f12]/80 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-[#a9c8bf]">Collection:</span>
                <span className="font-bold text-[#f4fff8]">{deleteSummary.collectionCount}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-[#a9c8bf]">Videos:</span>
                <span className="font-bold text-[#f4fff8]">{deleteSummary.videoCount}</span>
              </div>
            </div>

            <label className="flex flex-col gap-2 text-sm" htmlFor="delete-profile-confirmation">
              <span className="font-semibold text-[#f4fff8]">
                Type <span className="text-[#ffaaa0]">&quot;{deletePhrase}&quot;</span>
              </span>
              <input
                id="delete-profile-confirmation"
                className="w-full rounded-lg border border-[#ff6f60]/35 bg-[#0d0f12] px-4 py-3 text-[#f4fff8] outline-none placeholder:text-white/30 focus:border-[#ff6f60]"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder={deletePhrase}
                autoFocus
              />
            </label>

            <div className="flex justify-end gap-3">
              <button
                className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
                type="button"
                onClick={closeDeleteDialog}
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#220806] transition hover:bg-[#ff8a7e] disabled:opacity-50"
                type="button"
                onClick={() => void deleteProfile()}
                disabled={!canDeleteProfile}
              >
                <Trash2 size={18} />
                {isDeleting ? 'Deleting...' : 'Delete Library'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
