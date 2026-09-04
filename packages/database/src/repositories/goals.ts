// GoalRepository

import { eq, desc } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'
import * as schema from '../schema'
import type { GoalRow, NewGoalRow } from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export interface CreateGoalInput {
  conversationId?: string | undefined
  rawText: string
  normalizedText: string
  primaryObjective: string
  constraints: string[]
  requiredResources: string[]
  expectedOutcome: string
  context?: string | undefined
  confidence: number
}

export class GoalRepository {
  constructor(private readonly db: DB) {}

  async create(input: CreateGoalInput): Promise<GoalRow> {
    const row: NewGoalRow = {
      id: generateId(),
      conversationId: input.conversationId ?? null,
      rawText: input.rawText,
      normalizedText: input.normalizedText,
      primaryObjective: input.primaryObjective,
      constraints: JSON.stringify(input.constraints),
      requiredResources: JSON.stringify(input.requiredResources),
      expectedOutcome: input.expectedOutcome,
      context: input.context ?? null,
      confidence: input.confidence,
      status: 'pending',
      createdAt: toTimestamp(),
    }
    await this.db.insert(schema.goals).values(row)
    return this.db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.id, row.id))
      .get() as GoalRow
  }

  async findById(id: string): Promise<GoalRow | null> {
    return (
      this.db.select().from(schema.goals).where(eq(schema.goals.id, id)).get() ?? null
    )
  }

  async listByConversation(conversationId: string): Promise<GoalRow[]> {
    return this.db
      .select()
      .from(schema.goals)
      .where(eq(schema.goals.conversationId, conversationId))
      .orderBy(desc(schema.goals.createdAt))
      .all()
  }

  async updateStatus(id: string, status: GoalRow['status']): Promise<void> {
    await this.db
      .update(schema.goals)
      .set({ status })
      .where(eq(schema.goals.id, id))
  }
}
