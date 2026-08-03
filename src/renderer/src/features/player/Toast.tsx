export type ToastMessage = {
  title: string
  description?: string
}

type ToastProps = {
  message: ToastMessage | null
}

export function Toast({ message }: ToastProps): React.JSX.Element | null {
  if (!message) return null

  return (
    <div className="pointer-events-none absolute top-[78px] left-[22px] z-30 rounded-md border border-white/10 bg-black/55 px-3 py-2 text-left text-xs text-[#f3f5fb] shadow-[0_10px_32px_rgba(0,0,0,0.32)] backdrop-blur-md">
      <div className="font-bold">{message.title}</div>
      {message.description && (
        <div className="mt-0.5 text-[#ebeef8]/70 tabular-nums">{message.description}</div>
      )}
    </div>
  )
}
