import type { ID, Timestamp, Nullable } from './primitives'

/** Supported AI provider types */
export type ProviderType = 'ollama' | 'lmstudio' | 'openai-compatible'

/** Provider health status */
export type ProviderStatus = 'online' | 'offline' | 'error' | 'unknown'

/** AI model descriptor returned by a provider */
export interface AIModel {
  id: string
  name: string
  /** Provider-specific additional info */
  details?: Record<string, unknown>
}

/** Stored provider configuration */
export interface Provider {
  id: ID
  name: string
  type: ProviderType
  baseUrl: string
  /** Whether this is the currently active provider */
  isEnabled: boolean
  /** Whether this is the default provider */
  isDefault: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}

/** Health check result */
export interface HealthCheckResult {
  status: ProviderStatus
  latencyMs: number
  message?: string
  models?: AIModel[]
}

/** Input for creating a provider configuration */
export interface CreateProviderInput {
  name: string
  type: ProviderType
  baseUrl: string
  isDefault?: boolean
}
