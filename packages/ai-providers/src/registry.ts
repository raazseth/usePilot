import type { AIProvider } from '@usepilot/ai-core'
import type { ProviderType } from '@usepilot/types'

import { OllamaProvider } from './ollama'
import { LMStudioProvider } from './lmstudio'
import { OpenAICompatibleProvider } from './openai-compatible'

interface ProviderConfig {
  id: string
  type: ProviderType
  name: string
  baseUrl: string
  apiKey?: string | undefined
}

/**
 * Registry that manages all configured AI providers.
 * Provides lazy initialization and lifecycle management.
 */
export class ProviderRegistry {
  private readonly providers = new Map<string, AIProvider>()
  private activeProviderId: string | null = null

  register(config: ProviderConfig): AIProvider {
    const provider = this.createProvider(config)
    this.providers.set(config.id, provider)
    return provider
  }

  get(id: string): AIProvider | null {
    return this.providers.get(id) ?? null
  }

  getActive(): AIProvider | null {
    if (!this.activeProviderId) return null
    return this.providers.get(this.activeProviderId) ?? null
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) {
      throw new Error(`Provider "${id}" is not registered`)
    }
    this.activeProviderId = id
  }

  listAll(): Array<{ id: string; provider: AIProvider }> {
    return Array.from(this.providers.entries()).map(([id, provider]) => ({ id, provider }))
  }

  remove(id: string): void {
    this.providers.delete(id)
    if (this.activeProviderId === id) {
      this.activeProviderId = null
    }
  }

  private createProvider(config: ProviderConfig): AIProvider {
    switch (config.type) {
      case 'ollama':
        return new OllamaProvider({ baseUrl: config.baseUrl, name: config.name })
      case 'lmstudio':
        return new LMStudioProvider({ baseUrl: config.baseUrl, name: config.name })
      case 'openai-compatible':
        return new OpenAICompatibleProvider({
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          name: config.name,
          providerType: 'openai-compatible',
        })
    }
  }
}
