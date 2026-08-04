import { Fragment, useState, type DragEvent } from 'react'
import { Film, GripVertical, Trash2 } from 'lucide-react'
import type { VideoFile } from '../../../../shared/types/media'
import { Tooltip } from '../../components/Tooltip'

type PlaylistPanelProps = {
  isVisible: boolean
  playlist: VideoFile[]
  activeIndex: number | null
  collectionName?: string | null
  onPlay: (index: number, autoplay?: boolean) => void
  onRemove: (index: number) => void
  onReorder: (fromIndex: number, toIndex: number) => void
}

export function PlaylistPanel({
  isVisible,
  playlist,
  activeIndex,
  collectionName,
  onPlay,
  onRemove,
  onReorder
}: PlaylistPanelProps): React.JSX.Element {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number): void => {
    setDraggedIndex(index)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(index))
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>, index: number): void => {
    event.preventDefault()

    const fromIndex = Number(event.dataTransfer.getData('text/plain'))
    const safeFromIndex = Number.isFinite(fromIndex) ? fromIndex : draggedIndex

    if (safeFromIndex !== null) {
      onReorder(safeFromIndex, index)
    }

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  return (
    <aside
      className={[
        'grid h-full min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-x-hidden border-r border-white/10 bg-[#0b0c0f] transition-[opacity,transform,filter] duration-300 ease-out',
        isVisible
          ? 'translate-x-0 opacity-100 blur-0'
          : 'pointer-events-none -translate-x-4 opacity-0 blur-sm'
      ].join(' ')}
      aria-hidden={!isVisible}
    >
      <header className="border-b border-white/10 px-4 py-4">
        <h2 className="truncate text-sm font-bold text-[#f3f5fb]">
          {collectionName ?? 'Playlist'}
        </h2>
        <p className="mt-0.5 text-xs text-[#ebeef8]/55">
          {playlist.length > 0 ? `${playlist.length} videos in temporary queue` : 'Temporary queue'}
        </p>
      </header>

      <div className="min-h-0 overflow-x-hidden overflow-y-auto p-3">
        {playlist.length > 0 ? (
          <div className="grid min-w-0 gap-2">
            {playlist.map((video, index) => {
              const isActive = index === activeIndex
              const isDragTarget = index === dragOverIndex && draggedIndex !== index
              const showSourceHeader =
                index === 0 || playlist[index - 1]?.sourceName !== video.sourceName

              return (
                <Fragment key={video.path}>
                  {showSourceHeader && (
                    <div className="px-1 pt-2 text-[11px] font-bold uppercase text-[#00d982]">
                      {video.sourceName ?? 'Source'}
                    </div>
                  )}
                  <div
                    className={[
                      'grid min-w-0 grid-cols-[24px_40px_minmax(0,1fr)_32px] items-center gap-2 rounded-lg border p-2 text-left transition-colors',
                      isActive
                        ? 'border-white/20 bg-white/[0.085]'
                        : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]',
                      isDragTarget ? 'ring-1 ring-white/45' : ''
                    ].join(' ')}
                    draggable
                    onDragStart={(event) => handleDragStart(event, index)}
                    onDragOver={(event) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverIndex(index)
                    }}
                    onDragEnd={() => {
                      setDraggedIndex(null)
                      setDragOverIndex(null)
                    }}
                    onDrop={(event) => handleDrop(event, index)}
                  >
                    <span className="grid cursor-grab place-items-center text-[#ebeef8]/45 active:cursor-grabbing">
                      <GripVertical size={16} />
                    </span>
                    <button
                      className="grid h-10 w-10 place-items-center rounded-md bg-black/35 text-[#f3f5fb]"
                      type="button"
                      onClick={() => onPlay(index, true)}
                      aria-label={`Play ${video.name}`}
                    >
                      <Film size={18} />
                    </button>
                    <button
                      className="min-w-0 text-left"
                      type="button"
                      onClick={() => onPlay(index, true)}
                    >
                      <span className="block overflow-hidden text-ellipsis whitespace-nowrap text-sm font-semibold text-[#f3f5fb]">
                        {video.name}
                      </span>
                      <span className="mt-0.5 block overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#ebeef8]/55">
                        {video.path}
                      </span>
                    </button>
                    <Tooltip content="Remove from playlist">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-md text-[#ebeef8]/60 transition-colors hover:bg-white/10 hover:text-white"
                        type="button"
                        onClick={() => onRemove(index)}
                        aria-label={`Remove ${video.name} from playlist`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </Tooltip>
                  </div>
                </Fragment>
              )
            })}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-xs text-[#ebeef8]/45">
            No video in playlist.
          </div>
        )}
      </div>
    </aside>
  )
}
