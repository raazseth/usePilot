import { createDatabase, type DatabaseClient } from '@usepilot/database'

export type { DatabaseClient }

/**
 * Initialize the database and return the client.
 * Called once at bootstrap.
 */
export function initializeDatabase(dbPath: string): DatabaseClient {
  return createDatabase(dbPath)
}
