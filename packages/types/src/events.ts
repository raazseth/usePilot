import type { ID, JsonRecord } from './primitives'

// Unified Event Protocol

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
  /** Event protocol envelope version */
  eventVersion?: string | undefined
  /** Payload schema version */
  schemaVersion?: string | undefined
}

// Client → Server Events

export type ClientEventType =
  | 'conversation.create'
  | 'message.send'
  | 'message.stop'
  | 'provider.setActive'
  | 'settings.update'
  | 'health.ping'
  // Phase 2: Planner
  | 'plan.create'
  | 'plan.get'
  // Phase 3: Execution
  | 'execution.start'
  | 'execution.pause'
  | 'execution.resume'
  | 'execution.cancel'
  | 'execution.approve'
  | 'execution.reject'
  | 'execution.status'

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
  // Phase 2: Planner
  | AppEvent<{ conversationId: ID; text: string }> & { type: 'plan.create' }
  | AppEvent<{ planId: ID }> & { type: 'plan.get' }
  // Phase 3: Execution
  | AppEvent<{ planId: ID }> & { type: 'execution.start' }
  | AppEvent<{ runId: ID }> & { type: 'execution.pause' }
  | AppEvent<{ runId: ID }> & { type: 'execution.resume' }
  | AppEvent<{ runId: ID }> & { type: 'execution.cancel' }
  | AppEvent<{ runId: ID; taskId: ID; comment?: string }> & { type: 'execution.approve' }
  | AppEvent<{ runId: ID; taskId: ID; comment?: string }> & { type: 'execution.reject' }
  | AppEvent<{ runId: ID }> & { type: 'execution.status' }

// Server → Client Events

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
  // Phase 2: Planner
  | 'plan.progress'
  | 'plan.ready'
  | 'plan.error'
  // Phase 3: Execution
  | 'execution.started'
  | 'execution.progress'
  | 'execution.task.started'
  | 'execution.task.completed'
  | 'execution.task.failed'
  | 'execution.task.retrying'
  | 'execution.task.skipped'
  | 'execution.approval.required'
  | 'execution.approval.received'
  | 'execution.paused'
  | 'execution.resumed'
  | 'execution.completed'
  | 'execution.failed'
  | 'execution.cancelled'

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
  // Phase 2: Planner
  | AppEvent<{ runId: string; stage: string; progressPct: number; message: string }> & { type: 'plan.progress' }
  | AppEvent<{ runId: string; blueprint: unknown; planId: string; validation?: unknown }> & { type: 'plan.ready' }
  | AppEvent<{ runId: string; code: string; message: string; retries: number }> & { type: 'plan.error' }
  // Phase 3: Execution
  | AppEvent<{ runId: string; planId: string; traceId: string; taskCount: number }> & { type: 'execution.started' }
  | AppEvent<{ runId: string; traceId: string; completedCount: number; totalCount: number; currentTaskTitle: string }> & { type: 'execution.progress' }
  | AppEvent<{ runId: string; traceId: string; taskId: string; taskTitle: string; capability: string; attempt: number }> & { type: 'execution.task.started' }
  | AppEvent<{ runId: string; traceId: string; taskId: string; durationMs: number; verificationPassed: boolean }> & { type: 'execution.task.completed' }
  | AppEvent<{ runId: string; traceId: string; taskId: string; failureCategory: string; error: string; attempt: number }> & { type: 'execution.task.failed' }
  | AppEvent<{ runId: string; traceId: string; taskId: string; attempt: number; backoffMs: number }> & { type: 'execution.task.retrying' }
  | AppEvent<{ runId: string; traceId: string; taskId: string; reason: string }> & { type: 'execution.task.skipped' }
  | AppEvent<{ requestId: string; runId: string; taskId: string; taskTitle: string; capability: string; reason?: string }> & { type: 'execution.approval.required' }
  | AppEvent<{ runId: string; traceId: string; taskId: string; approved: boolean }> & { type: 'execution.approval.received' }
  | AppEvent<{ runId: string; traceId: string }> & { type: 'execution.paused' }
  | AppEvent<{ runId: string; traceId: string }> & { type: 'execution.resumed' }
  | AppEvent<{ result: unknown }> & { type: 'execution.completed' }
  | AppEvent<{ runId: string; error: string; failedTaskId?: string }> & { type: 'execution.failed' }
  | AppEvent<{ runId: string; traceId: string }> & { type: 'execution.cancelled' }

/** Union of all event types */
export type EventType = ClientEventType | ServerEventType
