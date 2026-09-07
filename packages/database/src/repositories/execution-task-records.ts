// ExecutionTaskRecordRepository

import { eq } from 'drizzle-orm'
import { generateId, toTimestamp } from '@usepilot/utils'
import { executionTaskRecords } from '../schema'
import type { ExecutionTaskRecordRow, NewExecutionTaskRecordRow } from '../schema'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ExecutionTaskRecordRepository {
  constructor(private readonly db: DB) {}

  async create(data: {
    runId: string
    taskId: string
    taskTitle: string
    capability: string
  }): Promise<ExecutionTaskRecordRow> {
    const row: NewExecutionTaskRecordRow = {
      id: generateId(),
      runId: data.runId,
      taskId: data.taskId,
      taskTitle: data.taskTitle,
      capability: data.capability,
      status: 'pending',
      attemptCount: 0,
    }
    await this.db.insert(executionTaskRecords).values(row)
    return row as ExecutionTaskRecordRow
  }

  async findByRunId(runId: string): Promise<ExecutionTaskRecordRow[]> {
    return this.db.select().from(executionTaskRecords).where(eq(executionTaskRecords.runId, runId))
  }

  async update(
    id: string,
    data: Partial<Pick<ExecutionTaskRecordRow, 'status' | 'attemptCount' | 'adapterName' | 'adapterResult' | 'verificationResult' | 'failureCategory' | 'startedAt' | 'completedAt' | 'errorMessage'>>
  ): Promise<void> {
    await this.db.update(executionTaskRecords).set(data).where(eq(executionTaskRecords.id, id))
  }

  async markStarted(id: string, adapterName: string): Promise<void> {
    await this.db.update(executionTaskRecords)
      .set({ status: 'running', startedAt: toTimestamp(), adapterName })
      .where(eq(executionTaskRecords.id, id))
  }

  async markCompleted(id: string, adapterResult: unknown, verificationResult: unknown): Promise<void> {
    await this.db.update(executionTaskRecords).set({
      status: 'completed',
      completedAt: toTimestamp(),
      adapterResult: JSON.stringify(adapterResult),
      verificationResult: JSON.stringify(verificationResult),
    }).where(eq(executionTaskRecords.id, id))
  }

  async markFailed(id: string, error: string, failureCategory: string, attemptCount: number): Promise<void> {
    await this.db.update(executionTaskRecords).set({
      status: 'failed',
      completedAt: toTimestamp(),
      errorMessage: error,
      failureCategory,
      attemptCount,
    }).where(eq(executionTaskRecords.id, id))
  }
}
