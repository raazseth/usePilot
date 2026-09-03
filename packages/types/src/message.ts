import type { ID, Timestamp, Nullable } from './primitives'

/** All valid roles in a conversation */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

/** Lifecycle status of a message */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error' | 'cancelled'

/** Metadata stored alongside a message — extensible for Phase 2+ */
export interface MessageMetadata {
  /** The model that generated this response (assistant messages) */
  model?: string | undefined
  /** Finish reason from the provider */
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null | undefined
  /** Token usage — may not be available during streaming */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  } | undefined
  /** Provider that handled this message */
  provider?: string | undefined
  /** Latency in milliseconds from send to first token */
  firstTokenLatencyMs?: number | undefined
  /** Total generation duration in milliseconds */
  generationDurationMs?: number | undefined
}

/** Attachment reference — for Phase 2+ file/image support */
export interface MessageAttachment {
  id: ID
  type: 'image' | 'file' | 'audio'
  name: string
  mimeType: string
  size: number
  /** Local file path or data URI */
  url: string
}

/** Tool call request — for Phase 3+ agentic support */
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** Tool call result — for Phase 3+ agentic support */
export interface ToolResult {
  toolCallId: string
  content: string
  isError: boolean
}

/** Full message entity */
export interface Message {
  id: ID
  conversationId: ID
  role: MessageRole
  /** Text content — may be null for tool messages */
  content: Nullable<string>
  metadata: Nullable<MessageMetadata>
  /** File and image attachments — nullable until Phase 2 */
  attachments: Nullable<MessageAttachment[]>
  /** Tool calls made in this turn — nullable until Phase 3 */
  toolCalls: Nullable<ToolCall[]>
  /** Results of tool calls — nullable until Phase 3 */
  toolResults: Nullable<ToolResult[]>
  status: MessageStatus
  createdAt: Timestamp
  /** Non-null when soft-deleted */
  deletedAt: Nullable<Timestamp>
}

/** Input for creating a new user message */
export interface CreateMessageInput {
  conversationId: ID
  role: MessageRole
  content: string
}
