import { describe, it, expect } from 'vitest'
import { ProviderRegistry } from '../registry'
import { OllamaProvider } from '../ollama'
import { LMStudioProvider } from '../lmstudio'
import { OpenAICompatibleProvider } from '../openai-compatible'

describe('Provider Registry Integration', () => {
  it('registers and retrieves providers dynamically', () => {
    const registry = new ProviderRegistry()

    const ollama = registry.register({
      id: 'test-ollama',
      type: 'ollama',
      name: 'Local Ollama',
      baseUrl: 'http://localhost:11434',
    })

    expect(ollama).toBeInstanceOf(OllamaProvider)
    expect(ollama.name).toBe('Local Ollama')
    expect(ollama.type).toBe('ollama')

    const retrieved = registry.get('test-ollama')
    expect(retrieved).toBe(ollama)
  })

  it('manages active provider switching', () => {
    const registry = new ProviderRegistry()

    registry.register({
      id: 'p1',
      type: 'ollama',
      name: 'Ollama',
      baseUrl: 'http://localhost:11434',
    })

    registry.register({
      id: 'p2',
      type: 'lmstudio',
      name: 'LM Studio',
      baseUrl: 'http://localhost:1234',
    })

    expect(registry.getActive()).toBeNull()

    registry.setActive('p1')
    expect(registry.getActive()?.name).toBe('Ollama')

    registry.setActive('p2')
    expect(registry.getActive()?.name).toBe('LM Studio')

    expect(() => registry.setActive('non-existent')).toThrow()
  })

  it('instantiates OpenAI-compatible provider with custom headers and options', () => {
    const registry = new ProviderRegistry()

    const provider = registry.register({
      id: 'test-openai',
      type: 'openai-compatible',
      name: 'Groq / DeepSeek',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk_mock_token',
    })

    expect(provider).toBeInstanceOf(OpenAICompatibleProvider)
    expect(provider.type).toBe('openai-compatible')
  })

  it('handles offline provider health checks gracefully', async () => {
    const provider = new OllamaProvider({
      baseUrl: 'http://localhost:9999', // Non-existent port
      name: 'Offline Test Provider',
    })

    const health = await provider.healthCheck()
    expect(health.status).toBe('offline')
    expect(health.message).toBeDefined()
  })
})
