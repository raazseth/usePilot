import type { ID, JsonRecord } from './primitives'

// ─────────────────────────────────────────────────────────────────────────────
// Unified Event Protocol
// All WebSocket messages share this envelope.
// The frontend switches only on `type`.
// ─────────────────────────────────────────────────────────────────────────────

/** Envelope for every WebSocket event — client or server */
export interface AppEvent<P = unknown> {
  /** Nanoid — for client-side deduplication and tracking */
  id: ID
  /** Discriminated event type */
  type: EventType
  /** ISO 8601 timestamp */
  timestamp: string
  /** Event-specific payload */
  payload: P
}

// ─────────────────────────────────────────────────────────────────────────────
// Client → Server Events
// ─────────────────────────────────────────────────────────────────────────────

export type ClientEventType =
  | 'conversation.create'
  | 'message.send'
  | 'message.stop'
  | 'provider.setActive'
  | 'settings.update'
  | 'health.ping'

export interface ConversationCreatePayload {
  title?: string
  providerId?: ID
  model?: string
}

export interface MessageSendPayload {
  conversationId: ID
  content: string
  model?: string
  temperature?: number
  maxTokens?: number
}

export interface MessageStopPayload {
  conversationId: ID
  messageId?: ID
}

export interface ProviderSetActivePayload {
  providerId: ID
}

export interface SettingsUpdatePayload {
  key: string
  value: unknown
}

/** Typed client events union */
export type ClientEvent =
  | AppEvent<ConversationCreatePayload> & { type: 'conversation.create' }
  | AppEvent<MessageSendPayload> & { type: 'message.send' }
  | AppEvent<MessageStopPayload> & { type: 'message.stop' }
  | AppEvent<ProviderSetActivePayload> & { type: 'provider.setActive' }
  | AppEvent<SettingsUpdatePayload> & { type: 'settings.update' }
  | AppEvent<Record<string, never>> & { type: 'health.ping' }

// ─────────────────────────────────────────────────────────────────────────────
// Server → Client Events
// ─────────────────────────────────────────────────────────────────────────────

export type ServerEventType =
  | 'conversation.created'
  | 'conversation.updated'
  | 'conversation.deleted'
  | 'message.started'
  | 'message.chunk'
  | 'message.finished'
  | 'message.error'
  | 'provider.changed'
  | 'settings.changed'
  | 'health.pong'
  | 'error'

export interface ConversationCreatedPayload {
  conversationId: ID
  title: string
}

export interface MessageStartedPayload {
  messageId: ID
  conversationId: ID
  model: string
}

export interface MessageChunkPayload {
  messageId: ID
  conversationId: ID
  token: string
  /** Index of this chunk — for ordering */
  index: number
}

export interface MessageFinishedPayload {
  messageId: ID
  conversationId: ID
  finishReason: string
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export interface MessageErrorPayload {
  messageId: ID
  conversationId: ID
  code: string
  message: string
}

export interface HealthPongPayload {
  status: 'ok' | 'degraded'
  version: string
  uptime: number
}

export interface ErrorPayload {
  code: string
  message: string
  requestId?: ID
}

/** Typed server events union */
export type ServerEvent =
  | AppEvent<ConversationCreatedPayload> & { type: 'conversation.created' }
  | AppEvent<{ conversationId: ID; title: string }> & { type: 'conversation.updated' }
  | AppEvent<{ conversationId: ID }> & { type: 'conversation.deleted' }
  | AppEvent<MessageStartedPayload> & { type: 'message.started' }
  | AppEvent<MessageChunkPayload> & { type: 'message.chunk' }
  | AppEvent<MessageFinishedPayload> & { type: 'message.finished' }
  | AppEvent<MessageErrorPayload> & { type: 'message.error' }
  | AppEvent<{ providerId: ID; providerType: string }> & { type: 'provider.changed' }
  | AppEvent<{ key: string; value: unknown }> & { type: 'settings.changed' }
  | AppEvent<HealthPongPayload> & { type: 'health.pong' }
  | AppEvent<ErrorPayload> & { type: 'error' }

/** Union of all event types */
export type EventType = ClientEventType | ServerEventType
