import {
  ChevronDown,
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
import logoIcon from '../../../../../public/logos/logo-icon.png'

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
  const navItemClassName = `flex w-full items-center rounded-lg py-2.5 text-left ${
    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3'
  }`
  const toggleCollapsed = (): void => {
    setIsCollapsed((current) => !current)
  }

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
      className={`flex h-full shrink-0 flex-col gap-9 overflow-hidden border-r border-white/[0.07] bg-[#131518] p-4 ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      <div className={`flex h-10 items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-2'}`}>
        <button
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#e9edf9] hover:bg-white"
          type="button"
          aria-label="NexMP"
          title="NexMP"
        >
          <img className="h-7 w-7 object-contain" src={logoIcon} alt="" />
        </button>
        {!isCollapsed && (
          <span className="min-w-0 flex-1 text-lg font-bold tracking-tight text-[#f4fff8]">
            NexMP
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-between gap-8 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-col gap-8">
          <nav
            className="flex flex-col gap-1"
            aria-label="Main navigation"
            onDoubleClick={toggleCollapsed}
          >
            {navigation.map(({ label, icon: Icon, path }) => {
              const active = path !== null && isRouteActive(path)

              return (
                <button
                  key={label}
                  className={`${navItemClassName} text-sm font-semibold ${
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
                  <Icon size={18} className="shrink-0" />
                  {!isCollapsed && <span className="min-w-0 truncate">{label}</span>}
                </button>
              )
            })}
          </nav>

          <div className="border-t border-white/[0.07] pt-6">
            <button
              className={`${navItemClassName} bg-[#00b875] text-sm font-bold text-[#04120d] hover:bg-[#00d982]`}
              type="button"
              onClick={onAddCollection}
              title={isCollapsed ? 'Add Collection' : undefined}
              aria-label="Add Collection"
            >
              <Plus size={18} className="shrink-0" />
              {!isCollapsed && <span className="min-w-0 truncate">Add Collection</span>}
            </button>
          </div>
        </div>

        <div
          className="flex flex-col gap-2 border-t border-white/[0.07] pt-4"
          onDoubleClick={toggleCollapsed}
        >
          <button
            className={`${navItemClassName} hover:bg-white/5`}
            type="button"
            onClick={() => {
              clearLoginProfile()
              navigate('/')
            }}
            title={isCollapsed ? (activeProfile?.name ?? 'Profile') : undefined}
            aria-label="Switch profile"
          >
            <span
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#176b61] text-xs font-bold text-white"
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
            className={`${navItemClassName} text-sm font-semibold ${
              isRouteActive('/home/settings')
                ? 'bg-[#00b875]/12 text-[#00d982]'
                : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
            }`}
            type="button"
            onClick={() => navigate('/home/settings')}
            title={isCollapsed ? 'Settings' : undefined}
            aria-label="Settings"
          >
            <Settings size={18} className="shrink-0" />
            {!isCollapsed && <span className="min-w-0 truncate">Settings</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}
