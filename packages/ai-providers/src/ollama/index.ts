import { AIProviderError } from '@usepilot/ai-core'
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
} from '@usepilot/ai-core'
import type { AIModel, HealthCheckResult, ProviderType } from '@usepilot/types'

interface OllamaConfig {
  baseUrl: string
  name?: string | undefined
}

// Ollama API response types
interface OllamaModel {
  name: string
  model: string
  modified_at: string
  size: number
  details?: {
    parameter_size?: string
    quantization_level?: string
  }
}

interface OllamaListModelsResponse {
  models: OllamaModel[]
}

interface OllamaStreamChunk {
  model: string
  message?: { role: string; content: string }
  done: boolean
  done_reason?: string
  prompt_eval_count?: number
  eval_count?: number
}

/**
 * Ollama provider implementation.
 * Uses Ollama's native /api/chat endpoint with NDJSON streaming.
 * Ollama is the default local-first provider.
 */
export class OllamaProvider implements AIProvider {
  readonly name: string
  readonly type: ProviderType = 'ollama'
  private readonly baseUrl: string

  constructor(config: OllamaConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '')
    this.name = config.name ?? 'Ollama'
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (!response.ok) {
        return { status: 'error', latencyMs: Date.now() - start, message: `HTTP ${response.status}` }
      }

      const data = (await response.json()) as OllamaListModelsResponse
      const models = data.models?.map((m) => ({ id: m.name, name: m.name })) ?? []

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
      const response = await fetch(`${this.baseUrl}/api/tags`)
      if (!response.ok) {
        throw AIProviderError.unavailable(this.name)
      }
      const data = (await response.json()) as OllamaListModelsResponse
      return (data.models ?? []).map((m) => ({
        id: m.name,
        name: m.name,
        details: { size: m.size, parameterSize: m.details?.parameter_size },
      }))
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

    // Link external signal to our controller
    if (request.signal) {
      request.signal.addEventListener('abort', () => controller.abort(), { once: true })
    }

    let response: Response
    try {
      response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: request.model,
          messages: request.messages,
          stream: true,
          options: {
            temperature: request.temperature,
            num_predict: request.maxTokens ?? undefined,
          },
        }),
        signal: controller.signal,
      })
    } catch (error) {
      if (controller.signal.aborted) throw AIProviderError.aborted(this.name)
      throw AIProviderError.unavailable(this.name, error)
    }

    if (!response.ok) {
      if (response.status === 404) throw AIProviderError.modelNotFound(this.name, request.model)
      throw AIProviderError.invalidResponse(this.name)
    }

    const reader = response.body?.getReader()
    if (!reader) throw AIProviderError.invalidResponse(this.name)

    const decoder = new TextDecoder()
    let buffer = ''
    let chunkIndex = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const parsed = JSON.parse(trimmed) as OllamaStreamChunk
            const token = parsed.message?.content ?? ''

            if (parsed.done) {
              yield {
                token,
                done: true,
                finishReason: parsed.done_reason === 'stop' ? 'stop' : 'length',
                usage: {
                  promptTokens: parsed.prompt_eval_count ?? 0,
                  completionTokens: parsed.eval_count ?? 0,
                  totalTokens: (parsed.prompt_eval_count ?? 0) + (parsed.eval_count ?? 0),
                },
              }
            } else {
              yield { token, done: false }
              chunkIndex++
            }
          } catch {
            // Skip malformed lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Ensure we always emit a done chunk
    if (chunkIndex === 0) {
      yield { token: '', done: true, finishReason: 'stop' }
    }
  }
}
