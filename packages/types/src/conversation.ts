import type { ID, Timestamp, Nullable } from './primitives'
import type { ProviderType } from './provider'

/** Full conversation entity */
export interface Conversation {
  id: ID
  title: string
  /** Active provider at time of last message */
  providerId: Nullable<ID>
  /** Active model at time of last message */
  model: Nullable<string>
  /** Number of messages — computed, not stored */
  messageCount?: number
  /** Preview of the last message — computed, not stored */
  lastMessagePreview?: Nullable<string>
  createdAt: Timestamp
  updatedAt: Timestamp
  /** Non-null when soft-deleted */
  deletedAt: Nullable<Timestamp>
}

/** Lightweight summary for sidebar listing */
export interface ConversationSummary {
  id: ID
  title: string
  providerId: Nullable<ID>
  providerType: Nullable<ProviderType>
  model: Nullable<string>
  lastMessagePreview: Nullable<string>
  messageCount: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Input for creating a new conversation */
export interface CreateConversationInput {
  title?: string
  providerId?: ID
  model?: string
}
