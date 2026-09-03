import { and, desc, eq, isNull, like, sql } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'

import * as schema from '../schema'
import type {
  ConversationRow,
  NewConversationRow,
} from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export interface CreateConversationInput {
  title?: string | undefined
  providerId?: string | undefined
  model?: string | undefined
}

export interface UpdateConversationInput {
  title?: string | undefined
  providerId?: string | undefined
  model?: string | undefined
}

export interface ConversationWithPreview extends ConversationRow {
  messageCount: number
  lastMessagePreview: string | null
}

/**
 * All conversation database operations.
 * Never called directly from route handlers — always via application layer.
 */
export class ConversationRepository {
  constructor(private readonly db: DB) {}

  async create(input: CreateConversationInput): Promise<ConversationRow> {
    const now = toTimestamp()
    const row: NewConversationRow = {
      id: generateId(),
      title: input.title ?? 'New Conversation',
      providerId: input.providerId ?? null,
      model: input.model ?? null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }
    await this.db.insert(schema.conversations).values(row)
    return row as ConversationRow
  }

  async findById(id: string): Promise<ConversationRow | null> {
    const result = await this.db
      .select()
      .from(schema.conversations)
      .where(and(eq(schema.conversations.id, id), isNull(schema.conversations.deletedAt)))
      .limit(1)
    return result[0] ?? null
  }

  async listAll(): Promise<ConversationWithPreview[]> {
    const rows = await this.db
      .select({
        id: schema.conversations.id,
        title: schema.conversations.title,
        providerId: schema.conversations.providerId,
        model: schema.conversations.model,
        createdAt: schema.conversations.createdAt,
        updatedAt: schema.conversations.updatedAt,
        deletedAt: schema.conversations.deletedAt,
        messageCount: sql<number>`COUNT(${schema.messages.id})`,
        lastMessagePreview: sql<string | null>`(
          SELECT SUBSTR(${schema.messages.content}, 1, 100)
          FROM ${schema.messages}
          WHERE ${schema.messages.conversationId} = ${schema.conversations.id}
            AND ${schema.messages.deletedAt} IS NULL
          ORDER BY ${schema.messages.createdAt} DESC
          LIMIT 1
        )`,
      })
      .from(schema.conversations)
      .leftJoin(
        schema.messages,
        and(
          eq(schema.messages.conversationId, schema.conversations.id),
          isNull(schema.messages.deletedAt)
        )
      )
      .where(isNull(schema.conversations.deletedAt))
      .groupBy(schema.conversations.id)
      .orderBy(desc(schema.conversations.updatedAt))

    return rows as ConversationWithPreview[]
  }

  async search(query: string): Promise<ConversationRow[]> {
    return this.db
      .select()
      .from(schema.conversations)
      .where(
        and(
          isNull(schema.conversations.deletedAt),
          like(schema.conversations.title, `%${query}%`)
        )
      )
      .orderBy(desc(schema.conversations.updatedAt))
  }

  async update(id: string, input: UpdateConversationInput): Promise<ConversationRow | null> {
    const existing = await this.findById(id)
    if (!existing) return null

    await this.db
      .update(schema.conversations)
      .set({
        ...input,
        updatedAt: toTimestamp(),
      })
      .where(eq(schema.conversations.id, id))

    return this.findById(id)
  }

  async softDelete(id: string): Promise<boolean> {
    await this.db
      .update(schema.conversations)
      .set({ deletedAt: toTimestamp() })
      .where(and(eq(schema.conversations.id, id), isNull(schema.conversations.deletedAt)))
    return true
  }

  async touchUpdatedAt(id: string): Promise<void> {
    await this.db
      .update(schema.conversations)
      .set({ updatedAt: toTimestamp() })
      .where(eq(schema.conversations.id, id))
  }
}
