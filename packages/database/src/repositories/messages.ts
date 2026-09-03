import { and, asc, eq, isNull } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'
import type { MessageMetadata, MessageAttachment, ToolCall, ToolResult } from '@usepilot/types'

import * as schema from '../schema'
import type { MessageRow, NewMessageRow } from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export interface CreateMessageInput {
  conversationId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content?: string
  metadata?: MessageMetadata
  attachments?: MessageAttachment[]
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
  status?: MessageRow['status']
}

export interface UpdateMessageInput {
  content?: string
  metadata?: MessageMetadata
  status?: MessageRow['status']
  toolCalls?: ToolCall[]
  toolResults?: ToolResult[]
}

/**
 * All message database operations.
 * JSON fields are serialized/deserialized transparently.
 */
export class MessageRepository {
  constructor(private readonly db: DB) {}

  async create(input: CreateMessageInput): Promise<MessageRow> {
    const now = toTimestamp()
    const row: NewMessageRow = {
      id: generateId(),
      conversationId: input.conversationId,
      role: input.role,
      content: input.content ?? null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      attachments: input.attachments ? JSON.stringify(input.attachments) : null,
      toolCalls: input.toolCalls ? JSON.stringify(input.toolCalls) : null,
      toolResults: input.toolResults ? JSON.stringify(input.toolResults) : null,
      status: input.status ?? 'pending',
      createdAt: now,
      deletedAt: null,
    }
    await this.db.insert(schema.messages).values(row)
    return row as MessageRow
  }

  async findById(id: string): Promise<MessageRow | null> {
    const result = await this.db
      .select()
      .from(schema.messages)
      .where(and(eq(schema.messages.id, id), isNull(schema.messages.deletedAt)))
      .limit(1)
    return result[0] ?? null
  }

  async findByConversationId(conversationId: string): Promise<MessageRow[]> {
    return this.db
      .select()
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          isNull(schema.messages.deletedAt)
        )
      )
      .orderBy(asc(schema.messages.createdAt))
  }

  async updateStatus(id: string, status: MessageRow['status']): Promise<void> {
    await this.db
      .update(schema.messages)
      .set({ status })
      .where(eq(schema.messages.id, id))
  }

  async update(id: string, input: UpdateMessageInput): Promise<MessageRow | null> {
    await this.db
      .update(schema.messages)
      .set({
        content: input.content,
        metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
        status: input.status,
        toolCalls: input.toolCalls ? JSON.stringify(input.toolCalls) : undefined,
        toolResults: input.toolResults ? JSON.stringify(input.toolResults) : undefined,
      })
      .where(eq(schema.messages.id, id))

    return this.findById(id)
  }

  async softDelete(id: string): Promise<boolean> {
    await this.db
      .update(schema.messages)
      .set({ deletedAt: toTimestamp() })
      .where(and(eq(schema.messages.id, id), isNull(schema.messages.deletedAt)))
    return true
  }

  /** Cancel any messages currently in 'streaming' or 'pending' status */
  async cancelStreamingMessages(conversationId: string): Promise<void> {
    await this.db
      .update(schema.messages)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(schema.messages.conversationId, conversationId),
          isNull(schema.messages.deletedAt)
        )
      )
  }
}
