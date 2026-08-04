import { ChevronDown, Search } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export function Header(): React.JSX.Element {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')

  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-6 border-b border-white/[0.07] px-8">
      <label className="flex w-full max-w-md items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3.5 py-2.5 text-[#a9c8bf] focus-within:border-[#00b875]/70">
        <Search size={18} />
        <input
          className="w-full bg-transparent text-sm text-[#f4fff8] outline-none placeholder:text-[#a9c8bf]/60"
          placeholder="Search collections and videos"
          aria-label="Search collections and videos"
          value={search}
          onChange={(event) => {
            const nextQuery = event.target.value
            setSearch(nextQuery)
            if (nextQuery.trim()) {
              navigate(`/home/search?q=${encodeURIComponent(nextQuery)}`)
            } else {
              navigate('/home')
            }
          }}
        />
      </label>
      <button
        className="flex shrink-0 items-center gap-3 rounded-lg p-1.5 pr-2.5 transition hover:bg-white/5"
        type="button"
        onClick={() => navigate('/')}
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#176b61] text-xs font-bold text-white">
          ME
        </span>
        <span className="text-sm font-semibold text-[#f4fff8]">Change profile</span>
        <ChevronDown size={16} className="text-[#a9c8bf]" />
      </button>
    </header>
  )
}
