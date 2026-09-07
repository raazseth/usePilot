// ExecutionCheckpointRepository

import { eq, desc } from 'drizzle-orm'
import { generateId, toTimestamp } from '@usepilot/utils'
import { executionCheckpoints } from '../schema'
import type { ExecutionCheckpointRow, NewExecutionCheckpointRow } from '../schema'
import type { ExecutionCheckpoint } from '@usepilot/execution-types'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ExecutionCheckpointRepository {
  constructor(private readonly db: DB) {}

  async save(checkpoint: Omit<ExecutionCheckpoint, 'id'>): Promise<ExecutionCheckpointRow> {
    const row: NewExecutionCheckpointRow = {
      id: generateId(),
      runId: checkpoint.runId,
      createdAt: checkpoint.createdAt,
      executionStatus: checkpoint.executionStatus,
      completedTaskIds: JSON.stringify(checkpoint.completedTaskIds),
      pendingTaskIds: JSON.stringify(checkpoint.pendingTaskIds),
      failedTaskIds: JSON.stringify(checkpoint.failedTaskIds),
      skippedTaskIds: JSON.stringify(checkpoint.skippedTaskIds),
      retryCounters: JSON.stringify(checkpoint.retryCounters),
      pendingApprovalTaskId: checkpoint.pendingApprovalTaskId,
      metadata: JSON.stringify(checkpoint.metadata),
    }
    await this.db.insert(executionCheckpoints).values(row)
    return row as ExecutionCheckpointRow
  }

  async getLatest(runId: string): Promise<ExecutionCheckpoint | null> {
    const rows = await this.db
      .select()
      .from(executionCheckpoints)
      .where(eq(executionCheckpoints.runId, runId))
      .orderBy(desc(executionCheckpoints.createdAt))
      .limit(1)

    const row = rows[0]
    if (!row) return null

    return {
      id: row.id,
      runId: row.runId,
      createdAt: row.createdAt,
      executionStatus: row.executionStatus as ExecutionCheckpoint['executionStatus'],
      completedTaskIds: JSON.parse(row.completedTaskIds) as string[],
      pendingTaskIds: JSON.parse(row.pendingTaskIds) as string[],
      failedTaskIds: JSON.parse(row.failedTaskIds) as string[],
      skippedTaskIds: JSON.parse(row.skippedTaskIds) as string[],
      retryCounters: JSON.parse(row.retryCounters) as Record<string, number>,
      pendingApprovalTaskId: row.pendingApprovalTaskId ?? undefined,
      metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    }
  }

  async listByRun(runId: string): Promise<ExecutionCheckpointRow[]> {
    return this.db
      .select()
      .from(executionCheckpoints)
      .where(eq(executionCheckpoints.runId, runId))
      .orderBy(executionCheckpoints.createdAt)
  }
}
