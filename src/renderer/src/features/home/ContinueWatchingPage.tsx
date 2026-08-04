import { Clock3 } from 'lucide-react'

export function ContinueWatchingPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="mb-2 text-sm font-semibold text-[#00d982]">CONTINUE WATCHING</p>
      <h1 className="text-3xl font-bold tracking-tight">Resume videos</h1>
      <div className="mt-10 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center">
        <Clock3 className="mx-auto text-[#a9c8bf]" size={30} />
        <h2 className="mt-4 text-xl font-bold">No videos in progress yet</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-[#a9c8bf]">
          Videos will appear here after playback progress is saved.
        </p>
      </div>
    </div>
  )
}
