import { ArrowDown, ArrowUp, GripVertical, Grid2X2, List } from 'lucide-react'
import { Fragment, useState, type DragEvent } from 'react'
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
  toolbarLeading?: React.ReactNode
  gridClassName?: string
}

type DropPlacement = 'before' | 'after'

export function CollectionDataViewer<T>({
  items,
  getId,
  emptyState,
  renderItem,
  isEditing = false,
  viewMode: controlledViewMode,
  onViewModeChange,
  onMove,
  toolbarLeading,
  gridClassName = 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'
}: CollectionDataViewerProps<T>): React.JSX.Element {
  const [localViewMode, setLocalViewMode] = useState<LibraryViewMode>('grid')
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [dropPlacement, setDropPlacement] = useState<DropPlacement>('before')
  const isOrdering = isEditing && Boolean(onMove)
  const requestedViewMode = controlledViewMode ?? localViewMode
  const viewMode = isOrdering ? 'list' : requestedViewMode

  const changeViewMode = (nextViewMode: LibraryViewMode): void => {
    setLocalViewMode(nextViewMode)
    if (!isOrdering) {
      onViewModeChange?.(nextViewMode)
    }
  }

  const getDropPlacement = (event: DragEvent<HTMLElement>): DropPlacement => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientY < bounds.top + bounds.height / 2 ? 'before' : 'after'
  }

  const getMoveTargetIndex = (
    currentIndex: number,
    targetIndex: number,
    placement: DropPlacement
  ): number => {
    if (placement === 'before') {
      return currentIndex < targetIndex ? targetIndex - 1 : targetIndex
    }

    return currentIndex > targetIndex ? targetIndex + 1 : targetIndex
  }

  const moveItemToIndex = (
    id: string,
    targetIndex: number,
    placement: DropPlacement = 'before'
  ): void => {
    if (!onMove) return

    const currentIndex = items.findIndex((item) => getId(item) === id)
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return
    const nextTargetIndex = getMoveTargetIndex(currentIndex, targetIndex, placement)
    if (currentIndex === nextTargetIndex) return

    const direction = nextTargetIndex > currentIndex ? 1 : -1
    const moveCount = Math.abs(nextTargetIndex - currentIndex)
    for (let index = 0; index < moveCount; index += 1) {
      onMove(id, direction)
    }
  }

  const resetDragState = (): void => {
    setDraggedId(null)
    setDragOverId(null)
    setDropPlacement('before')
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>{toolbarLeading}</div>
        <div className="flex rounded-lg border border-white/10 p-1">
          <button
            className={`grid h-8 w-8 place-items-center rounded-md ${
              viewMode === 'grid' ? 'bg-white/10 text-[#f4fff8]' : 'text-[#a9c8bf]'
            } disabled:cursor-not-allowed disabled:opacity-35`}
            type="button"
            onClick={() => changeViewMode('grid')}
            disabled={isOrdering}
            aria-label="Grid view"
            title={isOrdering ? 'List view is forced while ordering' : undefined}
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
        <div className={viewMode === 'grid' ? gridClassName : 'flex flex-col gap-3'}>
          {items.map((item, index) => {
            const id = getId(item)
            const isDragging = draggedId === id
            const isDragTarget = draggedId !== null && draggedId !== id && dragOverId === id
            const insertionMarker = isDragTarget ? (
              <div
                className={
                  viewMode === 'grid'
                    ? 'pointer-events-none min-h-24 rounded-xl border border-dashed border-[#00b875]/80 bg-[#00b875]/[0.08] shadow-[0_0_0_1px_rgba(0,184,117,0.32)] transition-all duration-200 ease-out'
                    : 'pointer-events-none h-2 rounded-full bg-[#00b875]/80 shadow-[0_0_16px_rgba(0,184,117,0.42)] transition-all duration-200 ease-out'
                }
              />
            ) : null

            return (
              <Fragment key={id}>
                {dropPlacement === 'before' && insertionMarker}
                <div
                  className={
                    isEditing
                      ? [
                          'relative flex min-w-0 items-stretch gap-2 rounded-xl border border-transparent transition-all duration-200 ease-out',
                          onMove ? 'cursor-grab active:cursor-grabbing' : '',
                          isDragging ? 'scale-[0.985] opacity-45' : '',
                          isDragTarget ? 'border-[#00b875]/50 bg-[#00b875]/[0.045]' : ''
                        ].join(' ')
                      : undefined
                  }
                  draggable={isEditing && Boolean(onMove)}
                  onDragStart={(event) => {
                    if (!onMove) return
                    const target = event.target
                    if (
                      target instanceof HTMLElement &&
                      target.closest('input, textarea, select')
                    ) {
                      event.preventDefault()
                      return
                    }

                    event.dataTransfer.effectAllowed = 'move'
                    event.dataTransfer.setData('text/plain', id)
                    setDraggedId(id)
                  }}
                  onDragOver={(event) => {
                    if (!draggedId || draggedId === id || !onMove) return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverId(id)
                    setDropPlacement(getDropPlacement(event))
                  }}
                  onDragEnter={(event) => {
                    if (!draggedId || draggedId === id || !onMove) return
                    setDragOverId(id)
                    setDropPlacement(getDropPlacement(event))
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const droppedId = event.dataTransfer.getData('text/plain') || draggedId
                    if (!droppedId || droppedId === id) {
                      resetDragState()
                      return
                    }
                    moveItemToIndex(droppedId, index, dropPlacement)
                    resetDragState()
                  }}
                  onDragEnd={resetDragState}
                >
                  {isEditing && onMove && (
                    <div className="flex shrink-0 flex-col justify-center gap-1">
                      <span
                        className="grid h-8 w-8 place-items-center rounded-md text-[#a9c8bf]"
                        aria-label="Drag to reorder"
                      >
                        <GripVertical size={16} />
                      </span>
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
                {dropPlacement === 'after' && insertionMarker}
              </Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
