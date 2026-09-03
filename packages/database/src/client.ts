import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'

import * as schema from './schema'

export type DatabaseClient = ReturnType<typeof createDatabase>

/**
 * Create and configure the SQLite database connection.
 * Applies PRAGMA settings for performance and reliability.
 */
export function createDatabase(dbPath: string): ReturnType<typeof drizzle<typeof schema>> {
  const sqlite = new Database(dbPath, { create: true })

  // Performance and reliability PRAGMAs
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA synchronous = NORMAL;
    PRAGMA busy_timeout = 5000;
    PRAGMA cache_size = -32000;
    PRAGMA temp_store = memory;
    PRAGMA mmap_size = 134217728;
  `)

  return drizzle(sqlite, { schema })
}

export { schema }
