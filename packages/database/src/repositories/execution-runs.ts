// ExecutionRunRepository

import { eq } from 'drizzle-orm'
import { generateId, toTimestamp } from '@usepilot/utils'
import { executionRuns } from '../schema'
import type { ExecutionRunRow, NewExecutionRunRow } from '../schema'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ExecutionRunRepository {
  constructor(private readonly db: DB) {}

  async create(data: {
    planId: string
    blueprintHash: string
    traceId: string
    tasksTotal: number
    contextSnapshot?: string
  }): Promise<ExecutionRunRow> {
    const row: NewExecutionRunRow = {
      id: generateId(),
      planId: data.planId,
      blueprintHash: data.blueprintHash,
      traceId: data.traceId,
      status: 'created',
      startedAt: toTimestamp(),
      tasksTotal: data.tasksTotal,
      tasksCompleted: 0,
      tasksFailed: 0,
      tasksSkipped: 0,
      contextSnapshot: data.contextSnapshot ?? null,
    }
    await this.db.insert(executionRuns).values(row)
    return row as ExecutionRunRow
  }

  async findById(id: string): Promise<ExecutionRunRow | null> {
    const rows = await this.db.select().from(executionRuns).where(eq(executionRuns.id, id))
    return rows[0] ?? null
  }

  async updateStatus(
    id: string,
    status: ExecutionRunRow['status'],
    extras?: Partial<Pick<ExecutionRunRow, 'completedAt' | 'errorCode' | 'tasksCompleted' | 'tasksFailed' | 'tasksSkipped'>>
  ): Promise<void> {
    await this.db
      .update(executionRuns)
      .set({ status, ...extras })
      .where(eq(executionRuns.id, id))
  }

  async incrementCompleted(id: string): Promise<void> {
    const row = await this.findById(id)
    if (!row) return
    await this.db.update(executionRuns)
      .set({ tasksCompleted: row.tasksCompleted + 1 })
      .where(eq(executionRuns.id, id))
  }

  async incrementFailed(id: string): Promise<void> {
    const row = await this.findById(id)
    if (!row) return
    await this.db.update(executionRuns)
      .set({ tasksFailed: row.tasksFailed + 1 })
      .where(eq(executionRuns.id, id))
  }

  async markCompleted(id: string, tasksCompleted: number, tasksFailed: number, tasksSkipped: number): Promise<void> {
    await this.db.update(executionRuns)
      .set({ status: 'completed', completedAt: toTimestamp(), tasksCompleted, tasksFailed, tasksSkipped })
      .where(eq(executionRuns.id, id))
  }

  async markFailed(id: string, errorCode: string): Promise<void> {
    await this.db.update(executionRuns)
      .set({ status: 'failed', completedAt: toTimestamp(), errorCode })
      .where(eq(executionRuns.id, id))
  }

  async markCancelled(id: string): Promise<void> {
    await this.db.update(executionRuns)
      .set({ status: 'cancelled', completedAt: toTimestamp() })
      .where(eq(executionRuns.id, id))
  }
}
