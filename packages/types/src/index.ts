// Core domain types for usePilot
// No runtime dependencies — pure TypeScript types only

export type { Conversation, ConversationSummary, CreateConversationInput } from './conversation'
export type {
  Message,
  MessageRole,
  MessageStatus,
  MessageMetadata,
  MessageAttachment,
  ToolCall,
  ToolResult,
  CreateMessageInput,
} from './message'
export type {
  Provider,
  ProviderType,
  ProviderStatus,
  AIModel,
  HealthCheckResult,
  CreateProviderInput,
} from './provider'
export type { Settings, UpdateSettingsInput } from './settings'
export type {
  AppEvent,
  ClientEvent,
  ServerEvent,
  EventType,
  ClientEventType,
  ServerEventType,
  ConversationCreatePayload,
  MessageSendPayload,
  MessageStopPayload,
  ProviderSetActivePayload,
  SettingsUpdatePayload,
  ConversationCreatedPayload,
  MessageStartedPayload,
  MessageChunkPayload,
  MessageFinishedPayload,
  MessageErrorPayload,
  HealthPongPayload,
  ErrorPayload,
} from './events'
export {
  IPCCommand,
  IPCQuery,
  IPCAppEvent,
} from './ipc'
export type {
  IPCCommandPayloads,
  IPCQueryPayloads,
  IPCQueryResults,
} from './ipc'
export type { Result, Ok, Err } from './result'
export type { ID, Timestamp, Nullable, Optional } from './primitives'
