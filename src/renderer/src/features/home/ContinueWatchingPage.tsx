import { ArrowLeft, Clock3, Play, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ContinueWatchingItem } from '../../../../shared/types/media'
import { Modal } from '../../components/Modal'
import type { PlayerRouteState } from '../collections/mediaPlayback'
import { formatTime } from '../player/time'

function getProgressPercent(item: ContinueWatchingItem): number {
  if (!item.durationSeconds || item.durationSeconds <= 0) return 0
  return Math.min(Math.max((item.positionSeconds / item.durationSeconds) * 100, 0), 100)
}

function formatLastPlayed(value: string | null): string {
  if (!value) return 'Recently played'

  return `Last played ${new Date(value).toLocaleDateString()}`
}

export function ContinueWatchingPage(): React.JSX.Element {
  const navigate = useNavigate()
  const [items, setItems] = useState<ContinueWatchingItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)
  const [isClearing, setIsClearing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadContinueWatching = useCallback(async (): Promise<void> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return
    }

    const nextItems = await window.api?.media.listContinueWatching(profileId)
    setItems(nextItems ?? [])
  }, [navigate])

  useEffect(() => {
    let isMounted = true

    const load = async (): Promise<void> => {
      try {
        setError(null)
        await loadContinueWatching()
      } catch (reason) {
        if (!isMounted) return
        setError(reason instanceof Error ? reason.message : 'Unable to load continue watching.')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    void load()

    return () => {
      isMounted = false
    }
  }, [loadContinueWatching])

  const resumeItem = (item: ContinueWatchingItem): void => {
    navigate('/player', {
      state: {
        playlist: item.playlist.length > 0 ? item.playlist : [item.video],
        selectedIndex: item.selectedIndex,
        collectionName: item.collectionName,
        returnTo: '/home/continue',
        startTime: item.positionSeconds
      } satisfies PlayerRouteState
    })
  }

  const clearHistory = async (): Promise<void> => {
    const profileId = sessionStorage.getItem('nexmp.active-profile-id')
    if (!profileId) {
      navigate('/')
      return
    }

    try {
      setIsClearing(true)
      setError(null)
      await window.api?.media.clearContinueWatching(profileId)
      setItems([])
      setIsClearConfirmOpen(false)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to clear continue watching.')
    } finally {
      setIsClearing(false)
    }
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-8">
      <button
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#a9c8bf] transition hover:text-[#f4fff8]"
        type="button"
        onClick={() => navigate('/home')}
      >
        <ArrowLeft size={17} />
        Back to Home
      </button>

      <div className="flex flex-wrap items-end justify-between gap-5">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-[#00d982]">CONTINUE WATCHING</p>
          <h1 className="text-3xl font-bold tracking-tight">Resume videos</h1>
          <p className="text-[#a9c8bf]">Jump back into videos you started from your library.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-[#a9c8bf]">
            {items.length} video{items.length === 1 ? '' : 's'}
          </div>
          {items.length > 0 && (
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-[#ffaaa0]/30 px-4 py-3 text-sm font-bold text-[#ffaaa0] transition hover:border-[#ffaaa0]/60 hover:bg-[#3e1c1f]/70 disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isClearing}
              onClick={() => setIsClearConfirmOpen(true)}
            >
              <Trash2 size={16} />
              Clear history
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-[#ffaaa0]">{error}</p>}

      {isLoading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="h-36 animate-pulse rounded-xl border border-white/[0.08] bg-white/[0.03]"
            />
          ))}
        </div>
      ) : items.length === 0 ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] px-8 py-16 text-center">
          <Clock3 className="text-[#a9c8bf]" size={32} />
          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-xl font-bold">No videos in progress yet</h2>
            <p className="text-sm text-[#a9c8bf]">
              Play a library video for a few seconds, then it will appear here.
            </p>
          </div>
        </section>
      ) : (
        <section className="grid gap-3 lg:grid-cols-2">
          {items.map((item) => {
            const progressPercent = getProgressPercent(item)

            return (
              <article
                key={item.id}
                className="flex min-w-0 flex-col gap-4 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 transition hover:border-[#00b875]/50 hover:bg-white/[0.055]"
              >
                <div className="flex items-start gap-4">
                  <span className="grid h-16 w-24 shrink-0 place-items-center rounded-lg bg-[#00b875]/10 text-[#00d982]">
                    <Play size={24} fill="currentColor" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <h2 className="truncate text-base font-bold text-[#f4fff8]">{item.filename}</h2>
                    <p className="truncate text-sm text-[#a9c8bf]">{item.collectionName}</p>
                    <p className="truncate text-xs text-[#a9c8bf]/75">{item.sourceName}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-[#00b875]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#a9c8bf]">
                    <span>
                      {formatTime(item.positionSeconds)} /{' '}
                      {item.durationSeconds ? formatTime(item.durationSeconds) : '--:--'}
                    </span>
                    <span>{formatLastPlayed(item.lastPlayedAt)}</span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    className="inline-flex items-center gap-2 rounded-lg bg-[#00b875] px-4 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982]"
                    type="button"
                    onClick={() => resumeItem(item)}
                  >
                    <Play size={16} fill="currentColor" />
                    Resume
                  </button>
                </div>
              </article>
            )
          })}
        </section>
      )}

      <Modal
        isOpen={isClearConfirmOpen}
        title="Clear continue watching"
        closeLabel="Close clear history modal"
        onClose={() => setIsClearConfirmOpen(false)}
      >
        <div className="flex flex-col gap-5">
          <p className="text-sm leading-6 text-[#a9c8bf]">
            This removes all saved resume positions for the current profile. Your collections,
            folders, and video files will stay untouched.
          </p>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isClearing}
              onClick={() => setIsClearConfirmOpen(false)}
            >
              Cancel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-lg bg-[#ff6f60] px-4 py-2 text-sm font-bold text-[#140605] transition hover:bg-[#ff8b7f] disabled:cursor-not-allowed disabled:opacity-50"
              type="button"
              disabled={isClearing}
              onClick={() => void clearHistory()}
            >
              <Trash2 size={16} />
              {isClearing ? 'Clearing...' : 'Clear history'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
