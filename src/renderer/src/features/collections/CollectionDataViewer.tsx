import { ArrowDown, ArrowUp, Grid2X2, List } from 'lucide-react'
import { useState } from 'react'
import type { LibraryViewMode } from './types'

type CollectionDataViewerProps<T> = {
  items: T[]
  getId: (item: T) => string
  emptyState: React.ReactNode
  renderItem: (item: T, viewMode: LibraryViewMode, index: number) => React.ReactNode
  isEditing?: boolean
  viewMode?: LibraryViewMode
  onViewModeChange?: (viewMode: LibraryViewMode) => void
  onMove?: (id: string, direction: -1 | 1) => void
}

export function CollectionDataViewer<T>({
  items,
  getId,
  emptyState,
  renderItem,
  isEditing = false,
  viewMode: controlledViewMode,
  onViewModeChange,
  onMove
}: CollectionDataViewerProps<T>): React.JSX.Element {
  const [localViewMode, setLocalViewMode] = useState<LibraryViewMode>('grid')
  const viewMode = controlledViewMode ?? localViewMode

  const changeViewMode = (nextViewMode: LibraryViewMode): void => {
    setLocalViewMode(nextViewMode)
    onViewModeChange?.(nextViewMode)
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-end">
        <div className="flex rounded-lg border border-white/10 p-1">
          <button
            className={`grid h-8 w-8 place-items-center rounded-md ${
              viewMode === 'grid' ? 'bg-white/10 text-[#f4fff8]' : 'text-[#a9c8bf]'
            }`}
            type="button"
            onClick={() => changeViewMode('grid')}
            aria-label="Grid view"
          >
            <Grid2X2 size={17} />
          </button>
          <button
            className={`grid h-8 w-8 place-items-center rounded-md ${
              viewMode === 'list' ? 'bg-white/10 text-[#f4fff8]' : 'text-[#a9c8bf]'
            }`}
            type="button"
            onClick={() => changeViewMode('list')}
            aria-label="List view"
          >
            <List size={17} />
          </button>
        </div>
      </div>
      {items.length === 0 ? (
        emptyState
      ) : (
        <div
          className={
            viewMode === 'grid' ? 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3' : 'flex flex-col gap-3'
          }
        >
          {items.map((item, index) => {
            const id = getId(item)

            return (
              <div key={id} className={isEditing ? 'flex min-w-0 items-stretch gap-2' : undefined}>
                {isEditing && onMove && (
                  <div className="flex shrink-0 flex-col justify-center gap-1">
                    <button
                      className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 disabled:opacity-40"
                      type="button"
                      onClick={() => onMove(id, -1)}
                      disabled={index === 0}
                      aria-label="Move up"
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf] hover:bg-white/5 disabled:opacity-40"
                      type="button"
                      onClick={() => onMove(id, 1)}
                      disabled={index === items.length - 1}
                      aria-label="Move down"
                    >
                      <ArrowDown size={16} />
                    </button>
                  </div>
                )}
                <div className="min-w-0 flex-1">{renderItem(item, viewMode, index)}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
