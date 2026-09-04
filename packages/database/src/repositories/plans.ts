// PlanRepository

import { eq, desc } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'
import type { ExecutionBlueprint, ValidationResult } from '@usepilot/planner-types'
import * as schema from '../schema'
import type { PlanRow, NewPlanRow } from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export interface CreatePlanInput {
  runId: string
  goalId: string
  conversationId?: string | undefined
  version: number
  hash: string
  status: PlanRow['status']
  executionBlueprint: ExecutionBlueprint
  validationResult?: ValidationResult | undefined
  planningDurationMs?: number | undefined
}

export class PlanRepository {
  constructor(private readonly db: DB) {}

  async create(input: CreatePlanInput): Promise<PlanRow> {
    const row: NewPlanRow = {
      id: generateId(),
      runId: input.runId,
      goalId: input.goalId,
      conversationId: input.conversationId ?? null,
      version: input.version,
      hash: input.hash,
      status: input.status,
      executionBlueprint: JSON.stringify(input.executionBlueprint),
      validationResult: input.validationResult ? JSON.stringify(input.validationResult) : null,
      planningDurationMs: input.planningDurationMs ?? null,
      createdAt: toTimestamp(),
    }
    await this.db.insert(schema.plans).values(row)
    return this.db.select().from(schema.plans).where(eq(schema.plans.id, row.id)).get() as PlanRow
  }

  async findById(id: string): Promise<PlanRow | null> {
    return this.db.select().from(schema.plans).where(eq(schema.plans.id, id)).get() ?? null
  }

  async listByConversation(conversationId: string, limit = 20): Promise<PlanRow[]> {
    return this.db
      .select()
      .from(schema.plans)
      .where(eq(schema.plans.conversationId, conversationId))
      .orderBy(desc(schema.plans.createdAt))
      .limit(limit)
      .all()
  }

  async listRecent(limit = 20): Promise<PlanRow[]> {
    return this.db
      .select()
      .from(schema.plans)
      .orderBy(desc(schema.plans.createdAt))
      .limit(limit)
      .all()
  }

  async updateStatus(id: string, status: PlanRow['status']): Promise<void> {
    await this.db.update(schema.plans).set({ status }).where(eq(schema.plans.id, id))
  }

  /** Parse the stored JSON and return a typed ExecutionBlueprint */
  parseBlueprint(row: PlanRow): ExecutionBlueprint {
    return JSON.parse(row.executionBlueprint) as ExecutionBlueprint
  }
}
