import { Settings } from 'lucide-react'

export function SettingsPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="mb-2 text-sm font-semibold text-[#00d982]">SETTINGS</p>
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <div className="mt-10 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-lg bg-[#00b875]/10 text-[#00d982]">
            <Settings size={22} />
          </span>
          <div>
            <h2 className="font-bold">Player preferences</h2>
            <p className="mt-1 text-sm text-[#a9c8bf]">
              Default volume, speed, and scan options can be wired here next.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
