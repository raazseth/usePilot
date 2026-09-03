import type { ID, Timestamp } from './primitives'
import type { ProviderType } from './provider'

/** Application theme */
export type AppTheme = 'dark' | 'light' | 'system'

/** Application settings (singleton row in DB) */
export interface Settings {
  id: ID
  theme: AppTheme
  /** Active provider ID */
  activeProviderId: string | null
  /** Active provider type (denormalized for quick access) */
  activeProviderType: ProviderType | null
  /** Default model to use */
  defaultModel: string | null
  /** Whether to stream responses */
  streamingEnabled: boolean
  /** LLM temperature (0.0 – 2.0) */
  temperature: number
  /** Max tokens per response (null = provider default) */
  maxTokens: number | null
  /** Local data storage path override */
  storagePath: string | null
  /** Feature flags (JSON) */
  featureFlags: Record<string, boolean>
  updatedAt: Timestamp
}

/** Partial settings update input */
export type UpdateSettingsInput = Partial<
  Omit<Settings, 'id' | 'updatedAt'>
>
