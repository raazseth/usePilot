import { OpenAICompatibleProvider } from '../openai-compatible'
import type { AIProvider } from '@usepilot/ai-core'
import type { ProviderType } from '@usepilot/types'

interface LMStudioConfig {
  baseUrl?: string | undefined
  name?: string | undefined
}

/**
 * LM Studio provider.
 * LM Studio runs a fully OpenAI-compatible server on localhost:1234.
 * This is a thin specialization of OpenAICompatibleProvider with LM Studio defaults.
 */
export class LMStudioProvider extends OpenAICompatibleProvider implements AIProvider {
  override readonly type: ProviderType = 'lmstudio'

  constructor(config: LMStudioConfig = {}) {
    super({
      baseUrl: config.baseUrl ?? 'http://localhost:1234',
      apiKey: 'lm-studio',  // LM Studio doesn't require a real key
      name: config.name ?? 'LM Studio',
      providerType: 'lmstudio',
    })
  }
}
