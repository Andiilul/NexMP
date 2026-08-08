import { randomUUID } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import type {
  ContinueWatchingItem,
  PlaybackProgressInput,
  PlaybackSessionInput,
  VideoFile
} from '../../shared/types/media'
import { getDatabase } from '../database'
import {
  collections,
  collectionSources,
  mediaFiles,
  playbackProgress,
  playbackSessions
} from '../database/schema'
import { createMediaProtocolUrl } from '../media/mediaProtocol'

function normalizeSeconds(value: number | null | undefined): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  return Math.max(0, Math.trunc(value))
}

function createPlaylistKey(playlist: VideoFile[]): string {
  return playlist
    .map((video) => video.mediaId ?? video.path)
    .filter(Boolean)
    .join('|')
}

function normalizePlaylistVideo(video: VideoFile): VideoFile {
  return {
    mediaId: video.mediaId,
    name: video.name,
    extension: video.extension,
    path: video.path,
    url: video.path ? createMediaProtocolUrl(video.path) : video.url,
    sourceName: video.sourceName,
    collectionName: video.collectionName
  }
}

function parsePlaylist(value: string): VideoFile[] {
  try {
    const parsed = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((video): video is VideoFile => {
        if (!video || typeof video !== 'object') return false
        const candidate = video as Partial<VideoFile>
        return (
          typeof candidate.name === 'string' &&
          typeof candidate.extension === 'string' &&
          typeof candidate.path === 'string'
        )
      })
      .map(normalizePlaylistVideo)
  } catch {
    return []
  }
}

export function savePlaybackProgress(input: PlaybackProgressInput): void {
  const positionSeconds = normalizeSeconds(input.positionSeconds) ?? 0
  const durationSeconds = normalizeSeconds(input.durationSeconds)
  const completed =
    input.completed ??
    (durationSeconds !== null && durationSeconds > 0 && positionSeconds >= durationSeconds - 5)
  const now = new Date().toISOString()
  const database = getDatabase()
  const media = database
    .select({ id: mediaFiles.id })
    .from(mediaFiles)
    .where(eq(mediaFiles.id, input.mediaFileId))
    .get()
  if (!media) return

  const existingProgress = database
    .select({ id: playbackProgress.id })
    .from(playbackProgress)
    .where(
      and(
        eq(playbackProgress.profileId, input.profileId),
        eq(playbackProgress.mediaFileId, input.mediaFileId)
      )
    )
    .get()

  const values = {
    positionSeconds,
    durationSeconds,
    completed,
    lastPlayedAt: now,
    updatedAt: now
  }

  if (existingProgress) {
    database
      .update(playbackProgress)
      .set(values)
      .where(eq(playbackProgress.id, existingProgress.id))
      .run()
    return
  }

  database
    .insert(playbackProgress)
    .values({
      id: randomUUID(),
      profileId: input.profileId,
      mediaFileId: input.mediaFileId,
      ...values
    })
    .run()
}

export function savePlaybackSession(input: PlaybackSessionInput): void {
  const database = getDatabase()
  const playlist = input.playlist
    .filter((video) => video.mediaId || video.path)
    .map(normalizePlaylistVideo)
  if (playlist.length === 0) return

  const activeIndex = Math.min(Math.max(input.activeIndex, 0), playlist.length - 1)
  const activeVideo = playlist[activeIndex]
  if (!activeVideo) return

  const playlistKey = createPlaylistKey(playlist)
  if (!playlistKey) return

  const positionSeconds = normalizeSeconds(input.positionSeconds) ?? 0
  const durationSeconds = normalizeSeconds(input.durationSeconds)
  const completed =
    input.completed ??
    (durationSeconds !== null && durationSeconds > 0 && positionSeconds >= durationSeconds - 5)
  const now = new Date().toISOString()
  const existingSession = database
    .select({ id: playbackSessions.id })
    .from(playbackSessions)
    .where(
      and(
        eq(playbackSessions.profileId, input.profileId),
        eq(playbackSessions.playlistKey, playlistKey)
      )
    )
    .get()

  const values = {
    playlistJson: JSON.stringify(playlist),
    collectionName: input.collectionName ?? activeVideo.collectionName ?? null,
    activeIndex,
    activeMediaFileId: activeVideo.mediaId ?? null,
    positionSeconds,
    durationSeconds,
    completed,
    lastPlayedAt: now,
    updatedAt: now
  }

  if (existingSession) {
    database
      .update(playbackSessions)
      .set(values)
      .where(eq(playbackSessions.id, existingSession.id))
      .run()
    return
  }

  database
    .insert(playbackSessions)
    .values({
      id: randomUUID(),
      profileId: input.profileId,
      playlistKey,
      ...values
    })
    .run()
}

function listContinueWatchingSessions(profileId: string): ContinueWatchingItem[] {
  const rows = getDatabase()
    .select({
      id: playbackSessions.id,
      mediaFileId: playbackSessions.activeMediaFileId,
      positionSeconds: playbackSessions.positionSeconds,
      durationSeconds: playbackSessions.durationSeconds,
      completed: playbackSessions.completed,
      lastPlayedAt: playbackSessions.lastPlayedAt,
      collectionName: playbackSessions.collectionName,
      activeIndex: playbackSessions.activeIndex,
      playlistJson: playbackSessions.playlistJson
    })
    .from(playbackSessions)
    .where(and(eq(playbackSessions.profileId, profileId), eq(playbackSessions.completed, false)))
    .orderBy(desc(playbackSessions.lastPlayedAt))
    .limit(30)
    .all()

  return rows.flatMap((row) => {
    const playlist = parsePlaylist(row.playlistJson)
    if (playlist.length === 0) return []

    const selectedIndex = Math.min(Math.max(row.activeIndex, 0), playlist.length - 1)
    const video = playlist[selectedIndex]
    if (!video) return []

    return [
      {
        id: row.id,
        mediaFileId: row.mediaFileId ?? video.mediaId ?? video.path,
        positionSeconds: row.positionSeconds,
        durationSeconds: row.durationSeconds,
        completed: row.completed,
        lastPlayedAt: row.lastPlayedAt,
        collectionId: '',
        collectionName: row.collectionName ?? video.collectionName ?? 'NexMP Playlist',
        sourceName: video.sourceName ?? 'Playlist',
        filename: video.name,
        filePath: video.path,
        extension: video.extension,
        video,
        playlist,
        selectedIndex
      }
    ]
  })
}

function listContinueWatchingProgress(profileId: string): ContinueWatchingItem[] {
  const rows = getDatabase()
    .select({
      id: playbackProgress.id,
      mediaFileId: playbackProgress.mediaFileId,
      positionSeconds: playbackProgress.positionSeconds,
      durationSeconds: playbackProgress.durationSeconds,
      completed: playbackProgress.completed,
      lastPlayedAt: playbackProgress.lastPlayedAt,
      collectionId: collections.id,
      collectionName: collections.name,
      sourceName: collectionSources.name,
      filename: mediaFiles.filename,
      filePath: mediaFiles.filePath,
      extension: mediaFiles.extension
    })
    .from(playbackProgress)
    .innerJoin(mediaFiles, eq(playbackProgress.mediaFileId, mediaFiles.id))
    .innerJoin(collectionSources, eq(mediaFiles.collectionSourceId, collectionSources.id))
    .innerJoin(collections, eq(collectionSources.collectionId, collections.id))
    .where(
      and(
        eq(playbackProgress.profileId, profileId),
        eq(playbackProgress.completed, false),
        eq(mediaFiles.isMissing, false),
        eq(mediaFiles.isPending, false)
      )
    )
    .orderBy(desc(playbackProgress.lastPlayedAt))
    .limit(30)
    .all()

  return rows.map((row) => ({
    ...row,
    video: {
      mediaId: row.mediaFileId,
      name: row.filename,
      extension: row.extension,
      path: row.filePath,
      url: createMediaProtocolUrl(row.filePath),
      sourceName: row.sourceName,
      collectionName: row.collectionName
    },
    playlist: [
      {
        mediaId: row.mediaFileId,
        name: row.filename,
        extension: row.extension,
        path: row.filePath,
        url: createMediaProtocolUrl(row.filePath),
        sourceName: row.sourceName,
        collectionName: row.collectionName
      }
    ],
    selectedIndex: 0
  }))
}

export function listContinueWatching(profileId: string): ContinueWatchingItem[] {
  const sessions = listContinueWatchingSessions(profileId)
  if (sessions.length > 0) return sessions

  return listContinueWatchingProgress(profileId)
}

export function clearContinueWatching(profileId: string): void {
  const database = getDatabase()
  database.delete(playbackSessions).where(eq(playbackSessions.profileId, profileId)).run()
  database.delete(playbackProgress).where(eq(playbackProgress.profileId, profileId)).run()
}
