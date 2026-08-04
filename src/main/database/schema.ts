import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: text('created_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`)
}

export const profiles = sqliteTable(
  'profiles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    avatarColor: text('avatar_color').notNull(),
    isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
    ...timestamps
  },
  (table) => [uniqueIndex('profiles_name_unique').on(table.name)]
)

export const collections = sqliteTable(
  'collections',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    coverPath: text('cover_path'),
    sortOrder: integer('sort_order').notNull().default(0),
    rating: integer('rating').notNull().default(0),
    isPinned: integer('is_pinned', { mode: 'boolean' }).notNull().default(false),
    ...timestamps
  },
  (table) => [
    index('collections_profile_order_index').on(table.profileId, table.sortOrder),
    uniqueIndex('collections_profile_name_unique').on(table.profileId, table.name)
  ]
)

// A CollectionSource is one physical folder included in a virtual Collection.
export const collectionSources = sqliteTable(
  'collection_sources',
  {
    id: text('id').primaryKey(),
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sourcePath: text('source_path').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    mediaOrder: text('media_order', { enum: ['custom', 'name', 'date'] })
      .notNull()
      .default('name'),
    isMissing: integer('is_missing', { mode: 'boolean' }).notNull().default(false),
    isDynamic: integer('is_dynamic', { mode: 'boolean' }).notNull().default(true),
    lastScannedAt: text('last_scanned_at'),
    ...timestamps
  },
  (table) => [
    index('collection_sources_collection_order_index').on(table.collectionId, table.sortOrder),
    uniqueIndex('collection_sources_collection_path_unique').on(
      table.collectionId,
      table.sourcePath
    )
  ]
)

export const mediaFiles = sqliteTable(
  'media_files',
  {
    id: text('id').primaryKey(),
    collectionSourceId: text('collection_source_id')
      .notNull()
      .references(() => collectionSources.id, { onDelete: 'cascade' }),
    filePath: text('file_path').notNull(),
    filename: text('filename').notNull(),
    extension: text('extension').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    durationSeconds: integer('duration_seconds'),
    sortOrder: integer('sort_order').notNull().default(0),
    isMissing: integer('is_missing', { mode: 'boolean' }).notNull().default(false),
    isPending: integer('is_pending', { mode: 'boolean' }).notNull().default(false),
    modifiedAt: text('modified_at'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('media_files_path_unique').on(table.filePath),
    index('media_files_source_order_index').on(table.collectionSourceId, table.sortOrder)
  ]
)

export const playbackProgress = sqliteTable(
  'playback_progress',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    mediaFileId: text('media_file_id')
      .notNull()
      .references(() => mediaFiles.id, { onDelete: 'cascade' }),
    positionSeconds: integer('position_seconds').notNull().default(0),
    durationSeconds: integer('duration_seconds'),
    completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
    audioTrack: text('audio_track'),
    subtitleTrack: text('subtitle_track'),
    lastPlayedAt: text('last_played_at'),
    ...timestamps
  },
  (table) => [
    uniqueIndex('playback_progress_profile_media_unique').on(table.profileId, table.mediaFileId),
    index('playback_progress_profile_last_played_index').on(table.profileId, table.lastPlayedAt)
  ]
)

export const tags = sqliteTable(
  'tags',
  {
    id: text('id').primaryKey(),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    color: text('color').notNull(),
    ...timestamps
  },
  (table) => [uniqueIndex('tags_profile_name_unique').on(table.profileId, table.name)]
)

export const collectionTags = sqliteTable(
  'collection_tags',
  {
    collectionId: text('collection_id')
      .notNull()
      .references(() => collections.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' })
  },
  (table) => [primaryKey({ columns: [table.collectionId, table.tagId] })]
)

// One row only. It stores app-wide preferences, not profile preferences.
export const settings = sqliteTable('settings', {
  id: text('id').primaryKey(),
  theme: text('theme').notNull().default('system'),
  defaultVolume: integer('default_volume').notNull().default(100),
  defaultSpeed: text('default_speed').notNull().default('1'),
  scanHiddenFiles: integer('scan_hidden_files', { mode: 'boolean' }).notNull().default(false),
  ...timestamps
})
