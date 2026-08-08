import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LayoutGrid,
  Plus,
  Settings,
  Tags,
  Trophy
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Profile } from '../../../../shared/types/profile'
import { useAppState } from '../../components/useAppState'

const navigation = [
  { label: 'Home', icon: LayoutGrid, path: '/home' },
  { label: 'Continue watching', icon: Clock3, path: '/home/continue' },
  { label: 'Tags', icon: Tags, path: '/home/tags' },
  { label: 'Tier List', icon: Trophy, path: '/home/tier-list' }
]

type SidebarProps = { onAddCollection: () => void }

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('')
}

export function Sidebar({ onAddCollection }: SidebarProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const {
    appState: { login },
    clearLoginProfile
  } = useAppState()
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)

  const isRouteActive = (path: string): boolean => {
    if (path === '/home') return location.pathname === path
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  useEffect(() => {
    if (!login) {
      setActiveProfile(null)
      return
    }

    const loadActiveProfile = (): void => {
      void window.api?.profiles
        .list()
        .then((profiles) =>
          setActiveProfile(profiles.find((profile) => profile.id === login.id) ?? null)
        )
    }
    const handleProfileUpdated = (event: Event): void => {
      const profile = (event as CustomEvent<Profile>).detail
      if (profile.id === login.id) setActiveProfile(profile)
    }

    loadActiveProfile()
    window.addEventListener('nexmp:profile-updated', handleProfileUpdated)

    return () => window.removeEventListener('nexmp:profile-updated', handleProfileUpdated)
  }, [login])

  return (
    <aside
      className={`flex h-full shrink-0 flex-col gap-9 overflow-y-auto border-r border-white/[0.07] bg-[#131518] p-4 transition-[width] duration-200 ease-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className={`flex items-center gap-3 px-2 ${isCollapsed ? 'justify-center' : ''}`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#00b875] text-lg font-black text-[#04120d]">
          N
        </span>
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1 text-lg font-bold tracking-tight text-[#f4fff8]">
              NexMP
            </span>
            <button
              className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
              type="button"
              onClick={() => setIsCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
            >
              <ChevronLeft size={17} />
            </button>
          </>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-8">
        <div className="flex flex-col gap-8">
          <nav className="flex flex-col gap-1" aria-label="Main navigation">
            {navigation.map(({ label, icon: Icon, path }) => {
              const active = path !== null && isRouteActive(path)

              return (
                <button
                  key={label}
                  className={`flex w-full items-center rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${
                    isCollapsed ? 'justify-center' : 'gap-3'
                  } ${
                    active
                      ? 'bg-[#00b875]/12 text-[#00d982]'
                      : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
                  }`}
                  type="button"
                  onClick={() => {
                    if (path) navigate(path)
                  }}
                  title={isCollapsed ? label : undefined}
                  aria-label={label}
                >
                  <Icon size={18} />
                  {!isCollapsed && label}
                </button>
              )
            })}
          </nav>

          <div className="border-t border-white/[0.07] pt-6">
            <button
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00b875] px-3 py-2.5 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982]"
              type="button"
              onClick={onAddCollection}
              title={isCollapsed ? 'Add Collection' : undefined}
              aria-label="Add Collection"
            >
              <Plus size={18} />
              {!isCollapsed && 'Add Collection'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-white/[0.07] pt-4">
          <button
            className={`flex w-full items-center rounded-lg px-2 py-2.5 text-left transition hover:bg-white/5 ${
              isCollapsed ? 'justify-center' : 'gap-3'
            }`}
            type="button"
            onClick={() => {
              clearLoginProfile()
              navigate('/')
            }}
            title={isCollapsed ? (activeProfile?.name ?? 'Profile') : undefined}
            aria-label="Switch profile"
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#176b61] text-xs font-bold text-white"
              style={activeProfile ? { backgroundColor: activeProfile.avatarColor } : undefined}
            >
              {activeProfile ? getInitials(activeProfile.name) : 'ME'}
            </span>
            {!isCollapsed && (
              <>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="block truncate text-sm font-semibold text-[#f4fff8]">
                    {activeProfile?.name ?? 'Profile'}
                  </span>
                  <span className="block truncate text-xs text-[#a9c8bf]">Switch library</span>
                </span>
                <ChevronDown size={16} className="shrink-0 text-[#a9c8bf]" />
              </>
            )}
          </button>

          <button
            className={`flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              isCollapsed ? 'justify-center' : 'gap-3'
            } ${
              isRouteActive('/home/settings')
                ? 'bg-[#00b875]/12 text-[#00d982]'
                : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
            }`}
            type="button"
            onClick={() => navigate('/home/settings')}
            title={isCollapsed ? 'Settings' : undefined}
            aria-label="Settings"
          >
            <Settings size={18} />
            {!isCollapsed && 'Settings'}
          </button>

          {isCollapsed && (
            <button
              className="grid h-10 w-full place-items-center rounded-lg text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
              type="button"
              onClick={() => setIsCollapsed(false)}
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <ChevronRight size={17} />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
