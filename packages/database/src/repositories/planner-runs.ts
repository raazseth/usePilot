// ─────────────────────────────────────────────────────────────────────────────
// PlannerRunRepository
// ─────────────────────────────────────────────────────────────────────────────

import { eq, desc } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'
import * as schema from '../schema'
import type { PlannerRunRow, NewPlannerRunRow } from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export class PlannerRunRepository {
  constructor(private readonly db: DB) {}

  async create(input: {
    goalId: string
    conversationId?: string | undefined
  }): Promise<PlannerRunRow> {
    const row: NewPlannerRunRow = {
      id: generateId(),
      goalId: input.goalId,
      conversationId: input.conversationId ?? null,
      status: 'started',
      stageReached: 'classifying',
      startedAt: toTimestamp(),
      completedAt: null,
      errorCode: null,
      retries: 0,
      tokenCount: 0,
    }
    await this.db.insert(schema.plannerRuns).values(row)
    return this.db
      .select()
      .from(schema.plannerRuns)
      .where(eq(schema.plannerRuns.id, row.id))
      .get() as PlannerRunRow
  }

  async findById(id: string): Promise<PlannerRunRow | null> {
    return (
      this.db.select().from(schema.plannerRuns).where(eq(schema.plannerRuns.id, id)).get() ?? null
    )
  }

  async listByGoal(goalId: string): Promise<PlannerRunRow[]> {
    return this.db
      .select()
      .from(schema.plannerRuns)
      .where(eq(schema.plannerRuns.goalId, goalId))
      .orderBy(desc(schema.plannerRuns.startedAt))
      .all()
  }

  async markSucceeded(id: string, tokenCount: number, stageReached: string): Promise<void> {
    await this.db
      .update(schema.plannerRuns)
      .set({
        status: 'succeeded',
        completedAt: toTimestamp(),
        tokenCount,
        stageReached,
      })
      .where(eq(schema.plannerRuns.id, id))
  }

  async markFailed(
    id: string,
    errorCode: string,
    retries: number,
    stageReached: string
  ): Promise<void> {
    await this.db
      .update(schema.plannerRuns)
      .set({
        status: 'failed',
        completedAt: toTimestamp(),
        errorCode,
        retries,
        stageReached,
      })
      .where(eq(schema.plannerRuns.id, id))
  }

  async updateStage(id: string, stageReached: string): Promise<void> {
    await this.db
      .update(schema.plannerRuns)
      .set({ stageReached })
      .where(eq(schema.plannerRuns.id, id))
  }
}
