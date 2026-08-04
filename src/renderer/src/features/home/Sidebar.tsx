import { ChevronDown, Clock3, LayoutGrid, Plus, Settings, Tags, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { Profile } from '../../../../shared/types/profile'

const navigation = [
  { label: 'Home', icon: LayoutGrid, path: '/home' },
  { label: 'Continue watching', icon: Clock3, path: '/home/continue' },
  { label: 'Tags', icon: Tags, path: '/home/tags' },
  { label: 'Tier List', icon: Trophy, path: null }
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
  const [activeProfile, setActiveProfile] = useState<Profile | null>(null)
  const isRouteActive = (path: string): boolean => {
    if (path === '/home') return location.pathname === path
    return location.pathname === path || location.pathname.startsWith(`${path}/`)
  }

  useEffect(() => {
    const activeProfileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!activeProfileId) return

    void window.api?.profiles
      .list()
      .then((profiles) =>
        setActiveProfile(profiles.find((profile) => profile.id === activeProfileId) ?? null)
      )
  }, [])

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col overflow-y-auto border-r border-white/[0.07] bg-[#131518] p-4">
      <div className="mb-9 flex items-center gap-3 px-2">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#00b875] text-lg font-black text-[#04120d]">
          N
        </span>
        <span className="text-lg font-bold tracking-tight text-[#f4fff8]">NexMP</span>
      </div>
      <nav className="space-y-1" aria-label="Main navigation">
        {navigation.map(({ label, icon: Icon, path }) => {
          const active = path !== null && isRouteActive(path)

          return (
            <button
              key={label}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold transition ${active ? 'bg-[#00b875]/12 text-[#00d982]' : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'}`}
              type="button"
              onClick={() => {
                if (path) navigate(path)
              }}
            >
              <Icon size={18} />
              {label}
            </button>
          )
        })}
      </nav>
      <div className="mt-8 border-t border-white/[0.07] pt-6">
        <button
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#00b875] px-3 py-2.5 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982]"
          type="button"
          onClick={onAddCollection}
        >
          <Plus size={18} />
          Add Collection
        </button>
      </div>
      <div className="mt-auto border-t border-white/[0.07] pt-4">
        <button
          className="mb-2 flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/5"
          type="button"
          onClick={() => navigate('/')}
        >
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#176b61] text-xs font-bold text-white"
            style={activeProfile ? { backgroundColor: activeProfile.avatarColor } : undefined}
          >
            {activeProfile ? getInitials(activeProfile.name) : 'ME'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-[#f4fff8]">
              {activeProfile?.name ?? 'Profile'}
            </span>
            <span className="mt-0.5 block truncate text-xs text-[#a9c8bf]">Switch library</span>
          </span>
          <ChevronDown size={16} className="shrink-0 text-[#a9c8bf]" />
        </button>
        <button
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
            isRouteActive('/home/settings')
              ? 'bg-[#00b875]/12 text-[#00d982]'
              : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
          }`}
          type="button"
          onClick={() => navigate('/home/settings')}
        >
          <Settings size={18} />
          Settings
        </button>
      </div>
    </aside>
  )
}
