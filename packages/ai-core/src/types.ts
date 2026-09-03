import type { AIModel } from '@usepilot/types'

export type { AIModel }

/** Capabilities advertised by a provider */
export interface ProviderCapabilities {
  streaming: boolean
  vision: boolean
  toolCalling: boolean
  embeddings: boolean
}

/** A model returned by listModels() */
export interface Model extends AIModel {
  /** Estimated context window in tokens */
  contextLength?: number
  /** Provider-reported capabilities for this specific model */
  capabilities?: Partial<ProviderCapabilities>
}
