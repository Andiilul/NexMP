type HotkeyItem = {
  keys: string
  action: string
}

type HotkeyCategory = {
  title: string
  items: HotkeyItem[]
}

type HotkeysModalProps = {
  onClose: () => void
}

const hotkeyCategories: HotkeyCategory[] = [
  {
    title: 'Playback',
    items: [
      { keys: 'Space', action: 'Play / Pause' },
      { keys: 'Ctrl + S', action: 'Stop current video' },
      { keys: 'M', action: 'Mute / Unmute' },
      { keys: 'F', action: 'Enter / exit fullscreen' },
      { keys: 'Esc', action: 'Exit fullscreen or close overlay' }
    ]
  },
  {
    title: 'Time Navigation',
    items: [
      { keys: 'Left / Right', action: 'Skip 5 seconds backward / forward' },
      { keys: 'Shift + Left / Right', action: 'Skip 10 seconds backward / forward' },
      { keys: 'Ctrl + Left / Right', action: 'Skip 30 seconds backward / forward' },
      { keys: 'Alt + Left / Right', action: 'Skip 1 minute backward / forward' }
    ]
  },
  {
    title: 'Playlist',
    items: [
      { keys: 'L', action: 'Open / close playlist' },
      { keys: 'N', action: 'Play next video' },
      { keys: 'P', action: 'Play previous video' }
    ]
  },
  {
    title: 'Volume',
    items: [
      { keys: 'Up / Down', action: 'Volume up / down' },
      { keys: 'M', action: 'Mute / Unmute' }
    ]
  },
  {
    title: 'Speed',
    items: [
      { keys: '[', action: 'Decrease playback speed' },
      { keys: ']', action: 'Increase playback speed' },
      { keys: '\\', action: 'Reset speed to 1.0x' }
    ]
  },
  {
    title: 'View',
    items: [
      { keys: 'G', action: 'Open hotkeys' },
      { keys: 'A', action: 'Cycle aspect ratio' }
    ]
  },
  {
    title: 'Tracks',
    items: [
      { keys: 'H', action: 'Subtitle on / off' },
      { keys: 'B', action: 'Switch audio track' }
    ]
  }
]

export function HotkeysModal({ onClose }: HotkeysModalProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/65 px-6 backdrop-blur-sm"
      onClick={onClose}
    >
      <section
        className="max-h-[78vh] w-full max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#101114] text-white shadow-[0_28px_80px_rgba(0,0,0,0.46)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotkeys-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="border-b border-white/10 px-6 py-5">
          <h2 id="hotkeys-title" className="text-xl font-bold">
            Hotkeys
          </h2>
          <p className="mt-1 text-sm text-[#ebeef8]/60">Keyboard shortcuts for the video player.</p>
        </header>

        <div className="grid max-h-[calc(78vh-96px)] gap-5 overflow-y-auto p-6 md:grid-cols-2">
          {hotkeyCategories.map((category) => (
            <section
              key={category.title}
              className="rounded-lg border border-white/10 bg-white/[0.035] p-4"
            >
              <h3 className="text-sm font-bold text-[#f3f5fb]">{category.title}</h3>
              <div className="mt-3 grid gap-2">
                {category.items.map((item) => (
                  <div
                    key={`${category.title}-${item.keys}`}
                    className="grid grid-cols-[150px_minmax(0,1fr)] gap-3 text-sm"
                  >
                    <kbd className="rounded border border-white/12 bg-black/40 px-2 py-1 text-center font-mono text-xs text-[#f3f5fb]">
                      {item.keys}
                    </kbd>
                    <span className="text-[#ebeef8]/70">{item.action}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>
    </div>
  )
}
