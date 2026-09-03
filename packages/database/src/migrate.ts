import { readFileSync, readdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { Database } from 'bun:sqlite'

interface MigrationFile {
  version: string
  sql: string
}

function getMigrationsDir(): string {
  const baseDir = typeof import.meta.dir === 'string'
    ? import.meta.dir
    : dirname(fileURLToPath(import.meta.url))

  const candidate1 = join(baseDir, 'migrations')
  if (existsSync(candidate1)) return candidate1

  const candidate2 = join(baseDir, '..', 'src', 'migrations')
  if (existsSync(candidate2)) return candidate2

  const candidate3 = join(process.cwd(), 'packages', 'database', 'src', 'migrations')
  if (existsSync(candidate3)) return candidate3

  return candidate1
}

/**
 * Run all pending forward migrations.
 * Tracks applied migrations in schema_migrations table.
 */
export async function migrate(dbPath: string): Promise<void> {
  const db = new Database(dbPath, { create: true })

  // Bootstrap the migrations table first
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `)

  const migrationsDir = getMigrationsDir()
  const migrations = getMigrationFiles(migrationsDir)

  const rows = db.query('SELECT version FROM schema_migrations').all() as Array<{ version: string }>
  const applied = new Set(rows.map((r) => r.version))

  let appliedCount = 0
  for (const migration of migrations) {
    if (applied.has(migration.version)) continue
    console.info(`[migrate] Applying migration ${migration.version}...`)
    db.exec(migration.sql)
    appliedCount++
  }

  if (appliedCount === 0) {
    console.info('[migrate] Database is up to date.')
  } else {
    console.info(`[migrate] Applied ${appliedCount} migration(s).`)
  }

  db.close()
}

/**
 * Roll back the last applied migration.
 */
export async function rollback(dbPath: string): Promise<void> {
  const db = new Database(dbPath)

  const last = db
    .query('SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1')
    .get() as { version: string } | null

  if (!last) {
    console.info('[rollback] No migrations to roll back.')
    db.close()
    return
  }

  const migrationsDir = getMigrationsDir()
  const rollbackPath = join(migrationsDir, `${last.version}_initial.rollback.sql`)

  let sql: string
  try {
    sql = readFileSync(rollbackPath, 'utf-8')
  } catch {
    console.error(`[rollback] Rollback file not found: ${rollbackPath}`)
    db.close()
    return
  }

  console.info(`[rollback] Rolling back migration ${last.version}...`)
  db.exec(sql)
  db.exec(`DELETE FROM schema_migrations WHERE version = '${last.version}'`)
  db.close()
  console.info(`[rollback] Rolled back migration ${last.version}.`)
}

function getMigrationFiles(dir: string): MigrationFile[] {
  const files = readdirSync(dir)
    .filter((f: string) => f.endsWith('.sql') && !f.includes('rollback'))
    .sort()

  return files.map((file: string) => {
    const version = file.split('_')[0] ?? file
    const sql = readFileSync(join(dir, file), 'utf-8')
    return { version, sql }
  })
}

// Allow running as a script: bun run src/migrate.ts
if (typeof import.meta !== 'undefined' && 'main' in import.meta && (import.meta as { main: boolean }).main) {
  const dbPath = process.env['DATABASE_PATH'] ?? './usepilot.db'
  await migrate(dbPath)
}
