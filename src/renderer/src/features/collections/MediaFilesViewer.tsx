import { ChevronDown, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { MediaFile, SourceMediaOrder } from '../../../../shared/types/collection'
import { Modal } from '../../components/Modal'
import { useToast } from '../../components/useToast'
import { CollectionDataViewer } from './CollectionDataViewer'
import { VideoCard } from './VideoCard'

export type MediaEditDraft = {
  id: string
  filename: string
  sortOrder: number
  media: MediaFile
}

export type SmartRenameSaveInput = {
  id: string
  filename: string
}

type MediaFilesViewerProps = {
  title: string
  mediaFiles: MediaFile[]
  onPlay: (media: MediaFile) => void
  emptyLabel?: string
  isEditing?: boolean
  editMedia?: MediaEditDraft[]
  orderBy?: SourceMediaOrder
  onOrderChange?: (orderBy: SourceMediaOrder) => Promise<void> | void
  onMove?: (mediaId: string, direction: -1 | 1) => void
  onRenameDraft?: (mediaId: string, filename: string) => void
  onRenameSave?: (mediaId: string, filename: string) => Promise<void> | void
  onDeleteMedia?: (mediaIds: string[]) => Promise<void> | void
  onSmartRenameSave?: (renames: SmartRenameSaveInput[]) => Promise<void> | void
}

type MediaFilesOrder = SourceMediaOrder
type SortableMedia = Pick<MediaFile, 'filename' | 'modifiedAt'>
type SmartRenameFile = {
  id: string
  filename: string
  editableName: string
  extension: string
}
type SmartRenameSegment =
  | {
      type: 'fixed'
      value: string
    }
  | {
      type: 'variable'
      values: string[]
    }
type SmartRenamePattern = {
  id: string
  label: string
  files: SmartRenameFile[]
  segments: SmartRenameSegment[]
}

const mediaFilesOrderOptions: { value: MediaFilesOrder; label: string }[] = [
  { value: 'custom', label: 'Custom' },
  { value: 'name', label: 'Name' },
  { value: 'date', label: 'Date' }
]

function compareMediaName(firstMedia: SortableMedia, secondMedia: SortableMedia): number {
  return firstMedia.filename.localeCompare(secondMedia.filename, undefined, {
    numeric: true,
    sensitivity: 'base'
  })
}

function getMediaDateValue(media: SortableMedia): number {
  if (!media.modifiedAt) return 0

  const value = new Date(media.modifiedAt).getTime()
  return Number.isFinite(value) ? value : 0
}

function getSortableMedia(item: MediaFile | MediaEditDraft): SortableMedia {
  if ('media' in item) {
    return { filename: item.filename, modifiedAt: item.media.modifiedAt }
  }

  return { filename: item.filename, modifiedAt: item.modifiedAt }
}

function getSmartRenameFile(media: MediaFile | MediaEditDraft): SmartRenameFile {
  const filename = media.filename
  const extension = 'media' in media ? media.media.extension : media.extension
  const normalizedExtension = extension.replace(/^\./, '')
  const expectedExtension = normalizedExtension ? `.${normalizedExtension}` : ''

  if (expectedExtension && filename.toLocaleLowerCase().endsWith(expectedExtension)) {
    return {
      id: media.id,
      filename,
      editableName: filename.slice(0, -expectedExtension.length),
      extension: filename.slice(-expectedExtension.length)
    }
  }

  const fallbackExtensionIndex = filename.lastIndexOf('.')
  if (fallbackExtensionIndex > 0) {
    return {
      id: media.id,
      filename,
      editableName: filename.slice(0, fallbackExtensionIndex),
      extension: filename.slice(fallbackExtensionIndex)
    }
  }

  return { id: media.id, filename, editableName: filename, extension: '' }
}

function orderMediaFiles<T extends MediaFile | MediaEditDraft>(
  items: T[],
  orderBy: MediaFilesOrder
): T[] {
  if (orderBy === 'custom') return items

  return [...items].sort((firstItem, secondItem) => {
    const firstMedia = getSortableMedia(firstItem)
    const secondMedia = getSortableMedia(secondItem)

    if (orderBy === 'date') {
      return (
        getMediaDateValue(secondMedia) - getMediaDateValue(firstMedia) ||
        compareMediaName(firstMedia, secondMedia)
      )
    }

    return compareMediaName(firstMedia, secondMedia)
  })
}

function getCommonPrefix(values: string[]): string {
  if (values.length === 0) return ''

  let prefix = values[0] ?? ''
  for (const value of values.slice(1)) {
    let index = 0
    while (index < prefix.length && index < value.length && prefix[index] === value[index]) {
      index += 1
    }
    prefix = prefix.slice(0, index)
    if (!prefix) break
  }

  return prefix
}

function isTokenChar(value: string | undefined): boolean {
  return value !== undefined && /^[A-Za-z0-9]$/.test(value)
}

function normalizeCommonPrefix(prefix: string, values: string[]): string {
  if (!prefix || !isTokenChar(prefix[prefix.length - 1])) return prefix

  const nextChars = values.map((value) => value[prefix.length])
  if (!nextChars.some(isTokenChar)) return prefix

  let safePrefix = prefix
  while (safePrefix && isTokenChar(safePrefix[safePrefix.length - 1])) {
    safePrefix = safePrefix.slice(0, -1)
  }

  return safePrefix
}

function getCommonSuffix(values: string[]): string {
  if (values.length === 0) return ''

  let suffix = values[0] ?? ''
  for (const value of values.slice(1)) {
    let index = 0
    while (
      index < suffix.length &&
      index < value.length &&
      suffix[suffix.length - 1 - index] === value[value.length - 1 - index]
    ) {
      index += 1
    }
    suffix = suffix.slice(suffix.length - index)
    if (!suffix) break
  }

  return suffix
}

function normalizeCommonSuffix(suffix: string, values: string[]): string {
  if (!suffix || !isTokenChar(suffix[0])) return suffix

  const previousChars = values.map((value) => value[value.length - suffix.length - 1])
  if (!previousChars.some(isTokenChar)) return suffix

  let safeSuffix = suffix
  while (safeSuffix && isTokenChar(safeSuffix[0])) {
    safeSuffix = safeSuffix.slice(1)
  }

  return safeSuffix
}

function findBoundaryCandidateIndex(value: string, candidate: string): number {
  let startIndex = 0

  while (startIndex <= value.length - candidate.length) {
    const candidateIndex = value.indexOf(candidate, startIndex)
    if (candidateIndex < 0) return -1

    const leftChar = value[candidateIndex - 1]
    const rightChar = value[candidateIndex + candidate.length]
    const hasLeftBoundary = !isTokenChar(leftChar) || !isTokenChar(candidate[0])
    const hasRightBoundary =
      !isTokenChar(rightChar) || !isTokenChar(candidate[candidate.length - 1])
    if (hasLeftBoundary && hasRightBoundary) {
      return candidateIndex
    }

    startIndex = candidateIndex + 1
  }

  return -1
}

function findLongestSharedSubstring(values: string[], minLength = 3): string {
  const shortest = [...values].sort((first, second) => first.length - second.length)[0] ?? ''

  for (let length = shortest.length; length >= minLength; length -= 1) {
    const checked = new Set<string>()
    for (let start = 0; start <= shortest.length - length; start += 1) {
      const candidate = shortest.slice(start, start + length)
      if (checked.has(candidate) || !candidate.trim()) continue
      checked.add(candidate)

      if (values.every((value) => findBoundaryCandidateIndex(value, candidate) >= 0)) {
        return candidate
      }
    }
  }

  return ''
}

function mergeSmartRenameSegments(segments: SmartRenameSegment[]): SmartRenameSegment[] {
  return segments.reduce<SmartRenameSegment[]>((merged, segment) => {
    if (segment.type === 'fixed' && segment.value.length === 0) return merged
    if (segment.type === 'variable' && segment.values.every((value) => value.length === 0)) {
      return merged
    }

    const lastSegment = merged[merged.length - 1]
    if (lastSegment?.type === 'fixed' && segment.type === 'fixed') {
      lastSegment.value += segment.value
      return merged
    }

    merged.push(segment)
    return merged
  }, [])
}

function createSmartRenameSegments(values: string[]): SmartRenameSegment[] {
  if (values.length === 0) return []
  if (values.every((value) => value === values[0])) {
    return values[0] ? [{ type: 'fixed', value: values[0] }] : []
  }

  const prefix = normalizeCommonPrefix(getCommonPrefix(values), values)
  const withoutPrefix = prefix ? values.map((value) => value.slice(prefix.length)) : values
  const suffix = normalizeCommonSuffix(getCommonSuffix(withoutPrefix), withoutPrefix)
  const middleValues = suffix
    ? withoutPrefix.map((value) => value.slice(0, value.length - suffix.length))
    : withoutPrefix

  if (prefix || suffix) {
    return mergeSmartRenameSegments([
      ...(prefix ? [{ type: 'fixed' as const, value: prefix }] : []),
      ...createSmartRenameMiddleSegments(middleValues),
      ...(suffix ? [{ type: 'fixed' as const, value: suffix }] : [])
    ])
  }

  return createSmartRenameMiddleSegments(values)
}

function createSmartRenameMiddleSegments(values: string[]): SmartRenameSegment[] {
  if (values.length === 0) return []
  if (values.every((value) => value === values[0])) {
    return values[0] ? [{ type: 'fixed', value: values[0] }] : []
  }

  const anchor = findLongestSharedSubstring(values)
  if (!anchor) {
    return [{ type: 'variable', values }]
  }

  const leftValues: string[] = []
  const rightValues: string[] = []
  for (const value of values) {
    const anchorIndex = findBoundaryCandidateIndex(value, anchor)
    leftValues.push(value.slice(0, anchorIndex))
    rightValues.push(value.slice(anchorIndex + anchor.length))
  }

  return mergeSmartRenameSegments([
    ...createSmartRenameMiddleSegments(leftValues),
    { type: 'fixed', value: anchor },
    ...createSmartRenameMiddleSegments(rightValues)
  ])
}

function getSmartRenameGroupKey(filename: string): string {
  const firstNumberIndex = filename.search(/\d/)
  if (firstNumberIndex > 0) return filename.slice(0, firstNumberIndex).toLocaleLowerCase()

  return filename.replace(/\d+/g, '#').toLocaleLowerCase()
}

function createSmartRenamePatterns(files: SmartRenameFile[]): SmartRenamePattern[] {
  const groupedFiles = new Map<string, SmartRenameFile[]>()
  for (const file of files) {
    const groupKey = getSmartRenameGroupKey(file.editableName)
    groupedFiles.set(groupKey, [...(groupedFiles.get(groupKey) ?? []), file])
  }

  return Array.from(groupedFiles.values()).map((groupFiles, index) => ({
    id: `smart-pattern-${index}`,
    label: `Pattern ${index + 1}`,
    files: groupFiles,
    segments:
      groupFiles.length === 1
        ? [{ type: 'fixed', value: groupFiles[0]?.editableName ?? '' }]
        : createSmartRenameSegments(groupFiles.map((file) => file.editableName))
  }))
}

function getSmartRenameVariablePreview(values: string[]): string {
  const uniqueValues = [...new Set(values.filter(Boolean))]
  if (uniqueValues.length === 0) return 'empty'
  if (uniqueValues.length <= 3) return uniqueValues.join(', ')

  return `${uniqueValues.slice(0, 3).join(', ')} +${uniqueValues.length - 3}`
}

function getSmartRenameExtensionPreview(files: SmartRenameFile[]): string {
  const extensions = [...new Set(files.map((file) => file.extension).filter(Boolean))]
  if (extensions.length === 0) return 'No extension'
  if (extensions.length === 1) return `${extensions[0]} locked`

  return `${extensions.length} extensions locked`
}

function renderSmartRenameEditableName(pattern: SmartRenamePattern, fileIndex: number): string {
  return pattern.segments
    .map((segment) =>
      segment.type === 'fixed' ? segment.value : (segment.values[fileIndex] ?? '')
    )
    .join('')
}

function renderSmartRenameFilename(pattern: SmartRenamePattern, fileIndex: number): string {
  const editableName = renderSmartRenameEditableName(pattern, fileIndex)
  const file = pattern.files[fileIndex]

  return `${editableName}${file?.extension ?? ''}`
}

function getDuplicateFilenames(filenames: string[]): string[] {
  const counts = new Map<string, { filename: string; count: number }>()

  for (const filename of filenames) {
    const normalizedFilename = filename.trim().toLocaleLowerCase()
    if (!normalizedFilename) continue
    const current = counts.get(normalizedFilename)
    counts.set(normalizedFilename, {
      filename: current?.filename ?? filename.trim(),
      count: (current?.count ?? 0) + 1
    })
  }

  return Array.from(counts.values())
    .filter((item) => item.count > 1)
    .map((item) => item.filename)
}

export function MediaFilesViewer({
  title,
  mediaFiles,
  onPlay,
  emptyLabel = 'No videos found yet.',
  isEditing = false,
  editMedia = [],
  orderBy: savedOrderBy,
  onOrderChange,
  onMove,
  onRenameDraft,
  onRenameSave,
  onDeleteMedia,
  onSmartRenameSave
}: MediaFilesViewerProps): React.JSX.Element {
  const toast = useToast()
  const [renameMedia, setRenameMedia] = useState<MediaEditDraft | MediaFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameExtension, setRenameExtension] = useState('')
  const [isSavingRename, setIsSavingRename] = useState(false)
  const [deleteMediaIds, setDeleteMediaIds] = useState<string[]>([])
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([])
  const [isDeletingMedia, setIsDeletingMedia] = useState(false)
  const [isSmartRenameOpen, setIsSmartRenameOpen] = useState(false)
  const [smartRenamePatterns, setSmartRenamePatterns] = useState<SmartRenamePattern[]>([])
  const [openSmartRenamePreviewIds, setOpenSmartRenamePreviewIds] = useState<string[]>([])
  const [isSavingSmartRename, setIsSavingSmartRename] = useState(false)
  const [smartRenameError, setSmartRenameError] = useState<string | null>(null)
  const [uncontrolledOrderBy, setUncontrolledOrderBy] = useState<MediaFilesOrder>('name')
  const orderBy = savedOrderBy ?? uncontrolledOrderBy
  const sortedMediaFiles = orderMediaFiles(mediaFiles, orderBy)
  const sortedEditMedia = orderMediaFiles(editMedia, orderBy)
  const smartRenameRenames = smartRenamePatterns.flatMap((pattern) =>
    pattern.files
      .map((file, fileIndex) => ({
        id: file.id,
        filename: renderSmartRenameFilename(pattern, fileIndex)
      }))
      .filter(
        (rename) =>
          rename.filename !== pattern.files.find((file) => file.id === rename.id)?.filename
      )
  )
  const hasInvalidSmartRename = smartRenamePatterns.some((pattern) =>
    pattern.files.some((_, fileIndex) => !renderSmartRenameEditableName(pattern, fileIndex).trim())
  )
  const smartRenameDuplicateNames = getDuplicateFilenames(
    smartRenamePatterns.flatMap((pattern) =>
      pattern.files.map((_, fileIndex) => renderSmartRenameFilename(pattern, fileIndex))
    )
  )
  const canMoveCustomOrder = orderBy === 'custom' ? onMove : undefined
  const deleteMediaNames = deleteMediaIds
    .map((mediaId) => mediaFiles.find((media) => media.id === mediaId)?.filename)
    .filter((filename): filename is string => Boolean(filename))

  const changeOrderBy = (nextOrderBy: SourceMediaOrder): void => {
    if (!savedOrderBy) setUncontrolledOrderBy(nextOrderBy)
    void onOrderChange?.(nextOrderBy)
  }

  const orderToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold text-[#a9c8bf]">Order</span>
      <div className="flex overflow-hidden rounded-lg border border-white/10">
        {mediaFilesOrderOptions.map((option) => (
          <button
            key={option.value}
            className={`px-3 py-2 text-xs font-bold transition ${
              orderBy === option.value
                ? 'bg-white/10 text-[#f4fff8]'
                : 'text-[#a9c8bf] hover:bg-white/5 hover:text-[#f4fff8]'
            }`}
            type="button"
            onClick={() => changeOrderBy(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )

  const openRename = (media: MediaEditDraft | MediaFile): void => {
    const renameFile = getSmartRenameFile(media)
    setRenameMedia(media)
    setRenameValue(renameFile.editableName)
    setRenameExtension(renameFile.extension)
  }

  const submitRename = async (): Promise<void> => {
    if (!renameMedia || !renameValue.trim()) return

    const nextFilename = `${renameValue}${renameExtension}`
    const baseMedia = isEditing ? editMedia : mediaFiles
    const nextFilenames = baseMedia.map((media) =>
      media.id === renameMedia.id ? nextFilename : media.filename
    )
    const duplicateNames = getDuplicateFilenames(nextFilenames)
    if (duplicateNames.length > 0) {
      toast.warning(
        'Rename blocked',
        `Duplicate filename in this folder: ${duplicateNames.slice(0, 3).join(', ')}`
      )
      return
    }

    if (isEditing) {
      onRenameDraft?.(renameMedia.id, nextFilename)
      setRenameMedia(null)
      setRenameExtension('')
      return
    }

    if (!onRenameSave) return
    try {
      setIsSavingRename(true)
      await onRenameSave(renameMedia.id, nextFilename)
      toast.success('Video renamed', nextFilename)
      setRenameMedia(null)
      setRenameExtension('')
    } catch (reason) {
      toast.warning('Rename failed', reason instanceof Error ? reason.message : undefined)
    } finally {
      setIsSavingRename(false)
    }
  }

  const closeRename = (): void => {
    if (isSavingRename) return
    setRenameMedia(null)
    setRenameExtension('')
  }

  const toggleSelectedMedia = (media: MediaFile, isSelected: boolean): void => {
    setSelectedMediaIds((currentIds) =>
      isSelected
        ? [...new Set([...currentIds, media.id])]
        : currentIds.filter((mediaId) => mediaId !== media.id)
    )
  }

  const selectAllMedia = (): void => {
    setSelectedMediaIds((isEditing ? sortedEditMedia : sortedMediaFiles).map((media) => media.id))
  }

  const clearSelectedMedia = (): void => {
    setSelectedMediaIds([])
  }

  const openDeleteMedia = (mediaIds: string[]): void => {
    setDeleteMediaIds(mediaIds)
  }

  const closeDeleteMedia = (): void => {
    if (isDeletingMedia) return
    setDeleteMediaIds([])
  }

  const confirmDeleteMedia = async (): Promise<void> => {
    if (!onDeleteMedia || deleteMediaIds.length === 0) return

    try {
      setIsDeletingMedia(true)
      await onDeleteMedia(deleteMediaIds)
      toast.success(
        deleteMediaIds.length === 1 ? 'Video deleted' : 'Videos deleted',
        `${deleteMediaIds.length} media ${deleteMediaIds.length === 1 ? 'row' : 'rows'} removed.`
      )
      setSelectedMediaIds((currentIds) =>
        currentIds.filter((mediaId) => !deleteMediaIds.includes(mediaId))
      )
      setDeleteMediaIds([])
    } catch (reason) {
      toast.warning('Delete failed', reason instanceof Error ? reason.message : undefined)
    } finally {
      setIsDeletingMedia(false)
    }
  }

  const openSmartRename = (): void => {
    const files = isEditing
      ? sortedEditMedia.map((media) => getSmartRenameFile(media))
      : sortedMediaFiles.map((media) => getSmartRenameFile(media))

    const nextPatterns = createSmartRenamePatterns(files)
    setSmartRenamePatterns(nextPatterns)
    setOpenSmartRenamePreviewIds([])
    setSmartRenameError(null)
    setIsSmartRenameOpen(true)
  }

  const toggleSmartRenamePreview = (patternId: string): void => {
    setOpenSmartRenamePreviewIds((currentIds) =>
      currentIds.includes(patternId)
        ? currentIds.filter((id) => id !== patternId)
        : [...currentIds, patternId]
    )
  }

  const updateSmartRenameFixedSegment = (
    patternId: string,
    segmentIndex: number,
    value: string
  ): void => {
    setSmartRenamePatterns((currentPatterns) =>
      currentPatterns.map((pattern) =>
        pattern.id === patternId
          ? {
              ...pattern,
              segments: pattern.segments.map((segment, index) =>
                index === segmentIndex && segment.type === 'fixed' ? { ...segment, value } : segment
              )
            }
          : pattern
      )
    )
  }

  const closeSmartRename = (): void => {
    if (isSavingSmartRename) return
    setIsSmartRenameOpen(false)
    setSmartRenameError(null)
  }

  const saveSmartRename = async (): Promise<void> => {
    if (!onSmartRenameSave || smartRenameRenames.length === 0 || hasInvalidSmartRename) return
    if (smartRenameDuplicateNames.length > 0) {
      toast.warning(
        'Smart Rename blocked',
        `Duplicate filename in this folder: ${smartRenameDuplicateNames.slice(0, 3).join(', ')}`
      )
      return
    }

    try {
      setIsSavingSmartRename(true)
      setSmartRenameError(null)
      await onSmartRenameSave(smartRenameRenames)
      setIsSmartRenameOpen(false)
      toast.success('Smart Rename saved', `${smartRenameRenames.length} media names updated.`)
    } catch (reason) {
      setSmartRenameError(
        reason instanceof Error ? reason.message : 'Unable to save smart rename changes.'
      )
      toast.warning(
        'Smart Rename failed',
        reason instanceof Error ? reason.message : 'Unable to save smart rename changes.'
      )
    } finally {
      setIsSavingSmartRename(false)
    }
  }

  return (
    <section className="flex flex-col gap-4 pt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold">{title}</h2>
          {isEditing && (
            <p className="text-xs text-[#a9c8bf]">
              {selectedMediaIds.length} selected for bulk actions
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isEditing && (
            <>
              <button
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                type="button"
                onClick={selectAllMedia}
                disabled={
                  (isEditing ? sortedEditMedia : sortedMediaFiles).length === 0 ||
                  selectedMediaIds.length ===
                    (isEditing ? sortedEditMedia : sortedMediaFiles).length
                }
              >
                Select all
              </button>
              <button
                className="rounded-lg border border-white/15 px-3 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5 disabled:opacity-60"
                type="button"
                onClick={clearSelectedMedia}
                disabled={selectedMediaIds.length === 0}
              >
                Clear
              </button>
              <button
                className="inline-flex items-center gap-2 rounded-lg border border-[#ff6f60]/35 px-3 py-2 text-sm font-bold text-[#ffaaa0] transition hover:bg-[#3e1c1f]/70 disabled:opacity-60"
                type="button"
                onClick={() => openDeleteMedia(selectedMediaIds)}
                disabled={selectedMediaIds.length === 0 || !onDeleteMedia}
              >
                <Trash2 size={16} />
                Delete selected
              </button>
            </>
          )}
          <button
            className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold text-[#f4fff8] transition hover:bg-white/5"
            type="button"
            onClick={openSmartRename}
          >
            Smart Rename
          </button>
        </div>
      </div>
      {isEditing ? (
        <CollectionDataViewer
          items={sortedEditMedia}
          getId={(item) => item.id}
          isEditing
          onMove={canMoveCustomOrder}
          toolbarLeading={orderToolbar}
          gridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          emptyState={
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
              {emptyLabel}
            </div>
          }
          renderItem={(item, viewMode) => (
            <VideoCard
              media={{ ...item.media, filename: item.filename }}
              viewMode={viewMode}
              onPlay={onPlay}
              onRename={() => openRename(item)}
              onDelete={() => openDeleteMedia([item.id])}
              isSelectable
              isSelected={selectedMediaIds.includes(item.id)}
              onSelectChange={toggleSelectedMedia}
            />
          )}
        />
      ) : (
        <CollectionDataViewer
          items={sortedMediaFiles}
          getId={(item) => item.id}
          toolbarLeading={orderToolbar}
          gridClassName="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
          emptyState={
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
              {emptyLabel}
            </div>
          }
          renderItem={(item, viewMode) => (
            <VideoCard
              media={item}
              viewMode={viewMode}
              onPlay={onPlay}
              onRename={() => openRename(item)}
              onDelete={() => openDeleteMedia([item.id])}
            />
          )}
        />
      )}

      <Modal
        isOpen={isSmartRenameOpen}
        title="Smart Rename"
        size="lg"
        className="flex max-h-[80vh] flex-col overflow-hidden overflow-x-hidden"
        onClose={closeSmartRename}
        closeLabel="Close smart rename"
      >
        <section className="flex min-h-0 flex-1 flex-col gap-5 overflow-x-hidden overflow-y-auto pr-1">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0d0f12]/70 px-4 py-3">
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-[#f4fff8]">
                Found {smartRenamePatterns.length}{' '}
                {smartRenamePatterns.length === 1 ? 'pattern' : 'patterns'}
              </p>
              <p className="text-xs text-[#a9c8bf]">
                Fixed text is editable. Variable chips are locked per file and will be preserved.
                Extensions are locked too. Save only updates the stored media name; file paths stay
                untouched.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#00b875]/15 px-3 py-1 text-xs font-bold text-[#00d982]">
                DB name only
              </span>
              <button
                className="rounded-lg bg-[#00b875] px-4 py-2 text-sm font-bold text-[#04120d] transition hover:bg-[#00d982] disabled:opacity-60"
                type="button"
                onClick={() => void saveSmartRename()}
                disabled={
                  !onSmartRenameSave ||
                  isSavingSmartRename ||
                  smartRenameRenames.length === 0 ||
                  hasInvalidSmartRename
                }
              >
                {isSavingSmartRename
                  ? 'Saving...'
                  : smartRenameRenames.length > 0
                    ? `Save ${smartRenameRenames.length}`
                    : 'Save'}
              </button>
            </div>
          </div>

          {hasInvalidSmartRename && (
            <p className="rounded-lg border border-[#ff6f60]/25 bg-[#3e1c1f]/60 px-3 py-2 text-sm text-[#ffaaa0]">
              Some generated names are empty. Add fixed text before saving.
            </p>
          )}
          {smartRenameDuplicateNames.length > 0 && (
            <p className="rounded-lg border border-[#f5b84b]/25 bg-[#2b2110]/70 px-3 py-2 text-sm text-[#f5c76d]">
              Duplicate names in this folder: {smartRenameDuplicateNames.slice(0, 3).join(', ')}
              {smartRenameDuplicateNames.length > 3
                ? ` +${smartRenameDuplicateNames.length - 3}`
                : ''}
            </p>
          )}
          {smartRenameError && (
            <p className="rounded-lg border border-[#ff6f60]/25 bg-[#3e1c1f]/60 px-3 py-2 text-sm text-[#ffaaa0]">
              {smartRenameError}
            </p>
          )}

          {smartRenamePatterns.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center text-[#a9c8bf]">
              No media files available for smart rename.
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {smartRenamePatterns.map((pattern) => (
                <div
                  key={pattern.id}
                  className="rounded-xl border border-[#00b875]/35 bg-[#0d0f12] p-4"
                >
                  <div className="flex items-center justify-between gap-3 pb-3">
                    <div className="flex flex-col gap-1">
                      <h3 className="text-sm font-bold text-[#f4fff8]">{pattern.label}</h3>
                      <p className="text-xs text-[#a9c8bf]">
                        {pattern.files.length} {pattern.files.length === 1 ? 'file' : 'files'} -{' '}
                        {pattern.segments.filter((segment) => segment.type === 'variable').length}{' '}
                        locked
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {pattern.segments.map((segment, segmentIndex) =>
                      segment.type === 'fixed' ? (
                        <input
                          key={`${pattern.id}-${segmentIndex}`}
                          className="min-w-[130px] flex-1 rounded-lg border border-white/15 bg-[#171a1f] px-3 py-2 text-sm text-[#f4fff8] outline-none focus:border-[#00b875]"
                          value={segment.value}
                          onChange={(event) =>
                            updateSmartRenameFixedSegment(
                              pattern.id,
                              segmentIndex,
                              event.target.value
                            )
                          }
                        />
                      ) : (
                        <span
                          key={`${pattern.id}-${segmentIndex}`}
                          className="rounded-lg border border-[#00b875]/45 bg-[#00b875]/10 px-3 py-2 text-sm font-black text-[#00d982]"
                          title={getSmartRenameVariablePreview(segment.values)}
                        >
                          {'{|||}'}
                        </span>
                      )
                    )}
                    <span
                      className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-bold text-[#a9c8bf]"
                      title="Extension is excluded from Smart Rename and preserved per file."
                    >
                      {getSmartRenameExtensionPreview(pattern.files)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 pt-3">
                    {pattern.segments
                      .filter(
                        (segment): segment is Extract<SmartRenameSegment, { type: 'variable' }> =>
                          segment.type === 'variable'
                      )
                      .map((segment, index) => (
                        <p key={index} className="truncate text-xs text-[#a9c8bf]">
                          Variable {index + 1}: {getSmartRenameVariablePreview(segment.values)}
                        </p>
                      ))}
                  </div>
                  <div className="flex flex-col gap-3 border-t border-white/10 pt-4">
                    <button
                      className="flex w-full items-center justify-between gap-3 rounded-lg border border-white/10 px-3 py-2 text-left transition hover:bg-white/[0.04]"
                      type="button"
                      onClick={() => toggleSmartRenamePreview(pattern.id)}
                      aria-expanded={openSmartRenamePreviewIds.includes(pattern.id)}
                    >
                      <span className="text-xs font-bold uppercase tracking-wide text-[#00d982]">
                        Preview
                      </span>
                      <ChevronDown
                        className={`text-[#a9c8bf] transition-transform ${
                          openSmartRenamePreviewIds.includes(pattern.id) ? 'rotate-0' : '-rotate-90'
                        }`}
                        size={17}
                      />
                    </button>
                    {openSmartRenamePreviewIds.includes(pattern.id) && (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        {pattern.files.map((file, fileIndex) => (
                          <div
                            key={file.id}
                            className="min-w-0 rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"
                          >
                            <p className="truncate text-xs text-[#a9c8bf]">{file.filename}</p>
                            <p className="truncate text-sm font-semibold text-[#f4fff8]">
                              {renderSmartRenameFilename(pattern, fileIndex)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </Modal>

      <Modal isOpen={renameMedia !== null} title="Rename video" size="sm" onClose={closeRename}>
        <div className="flex items-center gap-2">
          <input
            className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0d0f12] px-4 py-3 text-[#f4fff8] outline-none focus:border-[#00b875]"
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            autoFocus
          />
          {renameExtension && (
            <span
              className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-3 text-sm font-bold text-[#a9c8bf]"
              title="Extension is locked and will be preserved."
            >
              {renameExtension}
            </span>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
            type="button"
            onClick={closeRename}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-[#00b875] px-4 py-2.5 font-bold text-[#04120d] disabled:opacity-60"
            type="button"
            onClick={() => void submitRename()}
            disabled={!renameValue.trim() || isSavingRename}
          >
            {isSavingRename ? 'Saving...' : 'Save'}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={deleteMediaIds.length > 0}
        title={deleteMediaIds.length === 1 ? 'Delete video?' : 'Delete selected videos?'}
        size="sm"
        onClose={closeDeleteMedia}
      >
        <div className="rounded-lg border border-[#ff6f60]/25 bg-[#3e1c1f]/55 p-4 text-sm text-[#ffaaa0]">
          This only removes the saved media row from NexMP. The original file in Explorer will not
          be deleted.
        </div>
        <div className="max-h-44 overflow-y-auto rounded-lg border border-white/10 bg-[#0d0f12]/70">
          {deleteMediaNames.map((filename, index) => (
            <p
              key={`${filename}-${index}`}
              className="truncate border-b border-white/[0.06] px-3 py-2 text-sm"
            >
              {filename}
            </p>
          ))}
        </div>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-lg px-4 py-2.5 font-semibold text-[#a9c8bf] hover:bg-white/5"
            type="button"
            onClick={closeDeleteMedia}
            disabled={isDeletingMedia}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-[#ff6f60] px-4 py-2.5 font-bold text-[#220806] disabled:opacity-60"
            type="button"
            onClick={() => void confirmDeleteMedia()}
            disabled={isDeletingMedia || !onDeleteMedia}
          >
            {isDeletingMedia ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </section>
  )
}
