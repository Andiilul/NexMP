import { Clock3, LayoutGrid, Plus, Settings, Trophy } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const navigation = [
  { label: 'Home', icon: LayoutGrid, path: '/home' },
  { label: 'Continue watching', icon: Clock3, path: '/home/continue' },
  { label: 'Tier List', icon: Trophy, path: null }
]

type SidebarProps = { onAddCollection: () => void }

export function Sidebar({ onAddCollection }: SidebarProps): React.JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()

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
          const active =
            path !== null &&
            (label === 'Home' ? location.pathname === '/home' : location.pathname === path)

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
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#a9c8bf] transition hover:bg-white/5 hover:text-[#f4fff8]"
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
