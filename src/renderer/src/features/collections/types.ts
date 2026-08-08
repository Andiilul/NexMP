export type LibraryViewMode = 'grid' | 'list'

export type CollectionCardData = {
  id: string
  name: string
  sourceCount: number
  videoCount: number
  rating?: number
  isPinned?: boolean
  coverPath?: string | null
  updatedLabel?: string
  tags?: Array<{
    id: string
    name: string
    color: string
  }>
}

export type SourceCardData = {
  id: string
  name: string
  sourcePath: string
  videoCount: number
  isMissing?: boolean
  lastScannedLabel?: string
}
