import type { AIModel, HealthCheckResult, ProviderType } from '@usepilot/types'

// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Interface
// Every provider implementation must satisfy this contract exactly.
// Switching providers = changing configuration, never changing business logic.
// ─────────────────────────────────────────────────────────────────────────────

/** A single message in a chat conversation */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  /** Tool call ID — populated for tool role messages */
  toolCallId?: string
}

/** Request to the AI provider */
export interface ChatRequest {
  messages: ChatMessage[]
  model: string
  temperature?: number | undefined
  maxTokens?: number | null | undefined
  /** Abort signal for cancellation */
  signal?: AbortSignal | undefined
  /** Arbitrary provider-specific options */
  providerOptions?: Record<string, unknown> | undefined
}

/** A complete, non-streaming chat response */
export interface ChatResponse {
  content: string
  model: string
  finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/** A single token chunk from a streaming response */
export interface StreamChunk {
  /** The text token (may be empty for the final chunk) */
  token: string
  /** True only on the final chunk */
  done: boolean
  /** Only populated on the final chunk */
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null
  /** Only populated on the final chunk */
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

/**
 * The core AI provider interface.
 * All provider implementations must implement every method here.
 */
export interface AIProvider {
  /** Human-readable provider name */
  readonly name: string
  /** Provider type discriminator */
  readonly type: ProviderType

  /**
   * Check if the provider is reachable and healthy.
   * Should never throw — return status: 'error' instead.
   */
  healthCheck(): Promise<HealthCheckResult>

  /**
   * List available models from this provider.
   * @throws {AIProviderError} if the provider is unreachable
   */
  listModels(): Promise<AIModel[]>

  /**
   * Send a chat request and receive a complete response.
   * @throws {AIProviderError} on failure
   */
  chat(request: ChatRequest): Promise<ChatResponse>

  /**
   * Send a chat request and receive a streaming response.
   * The caller is responsible for handling AbortSignal in the request.
   * @throws {AIProviderError} on connection failure
   */
  streamChat(request: ChatRequest): AsyncIterable<StreamChunk>
}
