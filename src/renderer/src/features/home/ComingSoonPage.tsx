import type { LucideIcon } from 'lucide-react'
import { Trophy } from 'lucide-react'

type ComingSoonPageProps = {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
}

function ComingSoonPage({
  eyebrow,
  title,
  description,
  icon: Icon
}: ComingSoonPageProps): React.JSX.Element {
  return (
    <div className="flex w-full max-w-6xl flex-col gap-10">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold text-[#00d982]">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center">
        <Icon className="text-[#a9c8bf]" size={30} />
        <div className="flex max-w-md flex-col gap-2">
          <h2 className="text-xl font-bold">Coming soon</h2>
          <p className="text-sm text-[#a9c8bf]">{description}</p>
        </div>
      </div>
    </div>
  )
}

export function TierListPage(): React.JSX.Element {
  return (
    <ComingSoonPage
      eyebrow="TIER LIST"
      title="Tier List"
      description="Collection ranking and tier management will live here once the feature is ready."
      icon={Trophy}
    />
  )
}
