import { AIProviderError } from '@usepilot/ai-core'
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
} from '@usepilot/ai-core'
import type { AIModel, HealthCheckResult, ProviderType } from '@usepilot/types'

interface OpenAICompatibleConfig {
  baseUrl: string
  apiKey?: string | undefined
  name?: string | undefined
  providerType?: ProviderType | undefined
}

// OpenAI-compatible API types
interface OpenAIModel {
  id: string
  object: string
  created?: number
  owned_by?: string
}

interface OpenAIModelsResponse {
  object: string
  data: OpenAIModel[]
}

interface OpenAIDelta {
  content?: string
  role?: string
}

interface OpenAIStreamChoice {
  delta: OpenAIDelta
  index: number
  finish_reason: string | null
}

interface OpenAIStreamChunk {
  id: string
  object: string
  model: string
  choices: OpenAIStreamChoice[]
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

/**
 * OpenAI-compatible provider.
 * Works with: LM Studio, OpenAI, Anthropic (via proxy), Together.ai, etc.
 * Any provider that implements the /v1/chat/completions SSE streaming spec.
 */
export class OpenAICompatibleProvider implements AIProvider {
  readonly name: string
  readonly type: ProviderType
  private readonly baseUrl: string
  private readonly apiKey: string

  constructor(config: OpenAICompatibleConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.apiKey = config.apiKey ?? 'not-required'
    this.name = config.name ?? 'OpenAI Compatible'
    this.type = config.providerType ?? 'openai-compatible'
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (response.status === 401) {
        return { status: 'error', latencyMs: Date.now() - start, message: 'Invalid API key' }
      }

      if (!response.ok) {
        return { status: 'error', latencyMs: Date.now() - start, message: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as OpenAIModelsResponse
      const models = data.data?.map((m) => ({ id: m.id, name: m.id })) ?? []

      return { status: 'online', latencyMs: Date.now() - start, models }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return { status: 'offline', latencyMs: 5000, message: 'Connection timed out' }
      }
      return { status: 'offline', latencyMs: Date.now() - start, message: String(error) }
    }
  }

  async listModels(): Promise<AIModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        headers: this.getHeaders(),
      })

      if (response.status === 401) throw AIProviderError.authFailed(this.name)
      if (!response.ok) throw AIProviderError.unavailable(this.name)

      const data = (await response.json()) as OpenAIModelsResponse
      return (data.data ?? []).map((m) => ({ id: m.id, name: m.id }))
    } catch (error) {
      if (error instanceof AIProviderError) throw error
      throw AIProviderError.unavailable(this.name, error)
    }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const chunks: StreamChunk[] = []
    for await (const chunk of this.streamChat(request)) {
      chunks.push(chunk)
    }
    const content = chunks.map((c) => c.token).join('')
    const last = chunks[chunks.length - 1]
    return {
      content,
      model: request.model,
      finishReason: last?.finishReason ?? 'stop',
      usage: last?.usage ?? { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    }
  }

  async *streamChat(request: ChatRequest): AsyncIterable<StreamChunk> {
    const controller = new AbortController()

    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { ...this.getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) throw AIProviderError.aborted(this.name)
      throw AIProviderError.unavailable(this.name, error)
    }

    if (response.status === 401) throw AIProviderError.authFailed(this.name)
    if (response.status === 404) throw AIProviderError.modelNotFound(this.name, request.model)
    if (!response.ok) throw AIProviderError.invalidResponse(this.name)

    const reader = response.body?.getReader()
    if (!reader) throw AIProviderError.invalidResponse(this.name)

    const decoder = new TextDecoder()
    let buffer = ''
    let lastUsage: StreamChunk['usage'] = undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || trimmed === 'data: [DONE]') continue
          if (!trimmed.startsWith('data: ')) continue

          try {
            const json = trimmed.slice(6)
            const parsed = JSON.parse(json) as OpenAIStreamChunk
            const choice = parsed.choices[0]
            if (!choice) continue

            const token = choice.delta.content ?? ''
            const finishReason = choice.finish_reason

            if (parsed.usage) {
              lastUsage = {
                promptTokens: parsed.usage.prompt_tokens,
                completionTokens: parsed.usage.completion_tokens,
                totalTokens: parsed.usage.total_tokens,
              }
            }

            if (finishReason) {
              const chunk: StreamChunk = {
                token,
                done: true,
                finishReason: (finishReason as StreamChunk['finishReason']) ?? null,
              }
              if (lastUsage) {
                chunk.usage = lastUsage
              }
              yield chunk
            } else {
              yield { token, done: false }
            }
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: 'application/json',
    }
  }
}
