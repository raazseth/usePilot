import { describe, it, expect } from 'vitest'
import { AppConfigSchema } from '../app'
import { EnvironmentSchema } from '../environment'
import { FeatureFlagsSchema, defaultFeatureFlags } from '../features'

describe('config schemas', () => {
  it('validates default app config', () => {
    const config = AppConfigSchema.parse({})
    expect(config.name).toBe('usePilot')
    expect(config.version).toBe('0.1.0')
    expect(config.window.minWidth).toBe(900)
    expect(config.window.minHeight).toBe(600)
  })

  it('validates environment defaults', () => {
    const env = EnvironmentSchema.parse({})
    expect(env.NODE_ENV).toBe('development')
    expect(env.BACKEND_PORT).toBe(0)
    expect(env.LOG_LEVEL).toBe('info')
  })

  it('validates feature flags defaults with all future flags false', () => {
    const flags = FeatureFlagsSchema.parse(defaultFeatureFlags)
    expect(flags.experimental.streamingEnabled).toBe(true)
    expect(flags.ai.vision).toBe(false)
    expect(flags.ai.planner).toBe(false)
    expect(flags.ai.tools).toBe(false)
    expect(flags.ui.commandPalette).toBe(true)
  })
})
