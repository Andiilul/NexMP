import type Database from 'better-sqlite3'

type Migration = {
  version: number
  sql: string
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE profiles (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, avatar_color TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX profiles_name_unique ON profiles (name);

      CREATE TABLE collections (
        id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL, cover_path TEXT, sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX collections_profile_order_index ON collections (profile_id, sort_order);
      CREATE UNIQUE INDEX collections_profile_name_unique ON collections (profile_id, name);

      CREATE TABLE collection_sources (
        id TEXT PRIMARY KEY, collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        name TEXT NOT NULL, source_path TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0,
        is_missing INTEGER NOT NULL DEFAULT 0, last_scanned_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX collection_sources_collection_order_index ON collection_sources (collection_id, sort_order);
      CREATE UNIQUE INDEX collection_sources_collection_path_unique ON collection_sources (collection_id, source_path);

      CREATE TABLE media_files (
        id TEXT PRIMARY KEY, collection_source_id TEXT NOT NULL REFERENCES collection_sources(id) ON DELETE CASCADE,
        file_path TEXT NOT NULL, filename TEXT NOT NULL, extension TEXT NOT NULL, size_bytes INTEGER NOT NULL,
        duration_seconds INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, is_missing INTEGER NOT NULL DEFAULT 0,
        modified_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX media_files_path_unique ON media_files (file_path);
      CREATE INDEX media_files_source_order_index ON media_files (collection_source_id, sort_order);

      CREATE TABLE playback_progress (
        id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        media_file_id TEXT NOT NULL REFERENCES media_files(id) ON DELETE CASCADE,
        position_seconds INTEGER NOT NULL DEFAULT 0, duration_seconds INTEGER, completed INTEGER NOT NULL DEFAULT 0,
        audio_track TEXT, subtitle_track TEXT, last_played_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX playback_progress_profile_media_unique ON playback_progress (profile_id, media_file_id);
      CREATE INDEX playback_progress_profile_last_played_index ON playback_progress (profile_id, last_played_at);

      CREATE TABLE tags (
        id TEXT PRIMARY KEY, profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        name TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX tags_profile_name_unique ON tags (profile_id, name);

      CREATE TABLE collection_tags (
        collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
        PRIMARY KEY (collection_id, tag_id)
      );

      CREATE TABLE settings (
        id TEXT PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'system', default_volume INTEGER NOT NULL DEFAULT 100,
        default_speed TEXT NOT NULL DEFAULT '1', scan_hidden_files INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CHECK (id = 'app')
      );
    `
  }
]

export function runMigrations(sqlite: Database.Database): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `)

  const appliedVersions = new Set(
    sqlite
      .prepare('SELECT version FROM schema_migrations')
      .all()
      .map((row) => (row as { version: number }).version)
  )

  const apply = sqlite.transaction(() => {
    for (const migration of migrations) {
      if (appliedVersions.has(migration.version)) continue
      sqlite.exec(migration.sql)
      sqlite.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(migration.version)
    }
  })

  apply()
}
