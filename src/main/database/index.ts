import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { runMigrations } from './migrations'
import * as schema from './schema'

let sqlite: Database.Database | undefined
let database: BetterSQLite3Database<typeof schema> | undefined

export function getDatabasePath(): string {
  return join(app.getPath('userData'), 'data', 'nexmp.db')
}

/**
 * Creates an empty database when the file (or its data directory) was deleted.
 * Schema migrations are then applied before the renderer can make IPC requests.
 */
export function initializeDatabase(): BetterSQLite3Database<typeof schema> {
  if (database) return database

  const databasePath = getDatabasePath()
  mkdirSync(dirname(databasePath), { recursive: true })

  sqlite = new Database(databasePath)
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  runMigrations(sqlite)

  database = drizzle(sqlite, { schema })
  return database
}

export function closeDatabase(): void {
  sqlite?.close()
  sqlite = undefined
  database = undefined
}
