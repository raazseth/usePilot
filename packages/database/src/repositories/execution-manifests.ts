// ExecutionManifestRepository

import { eq } from 'drizzle-orm'
import { generateId } from '@usepilot/utils'
import { executionManifests } from '../schema'
import type { ExecutionManifestRow } from '../schema'
import type { ExecutionManifest } from '@usepilot/execution-types'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ExecutionManifestRepository {
  constructor(private readonly db: DB) {}

  async save(manifest: ExecutionManifest): Promise<ExecutionManifestRow> {
    const row = {
      id: manifest.manifestId || generateId(),
      runId: manifest.runId,
      manifestHash: manifest.manifestHash,
      manifest: JSON.stringify(manifest),
      createdAt: manifest.completedAt || Date.now(),
    }
    await this.db.insert(executionManifests).values(row)
    return row as ExecutionManifestRow
  }

  async findByRunId(runId: string): Promise<ExecutionManifest | null> {
    const rows = await this.db
      .select()
      .from(executionManifests)
      .where(eq(executionManifests.runId, runId))

    const row = rows[0]
    if (!row) return null

    return JSON.parse(row.manifest) as ExecutionManifest
  }
}
