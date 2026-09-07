import { describe, it, expect } from 'vitest'
import { PolicyBasedCapabilityNegotiator } from '../negotiator'
import type { AdapterRegistration, ICapabilityAdapter } from '@usepilot/execution-types'

function makeMockRegistration(
  name: string,
  priority: number,
  platformSupport: Array<'windows' | 'macos' | 'linux'> = [],
  isAvailable = true
): AdapterRegistration {
  return {
    capability: 'navigate_website',
    priority,
    platformSupport,
    name,
    factory: () => ({
      capability: 'navigate_website',
      priority,
      platformSupport,
      name,
      initialize: async () => {},
      execute: async () => ({ success: true, durationMs: 1 }),
      verify: async () => ({ passed: true, checkedConditions: [], failedConditions: [], strategy: 'state_check', durationMs: 1 }),
      cleanup: async () => {},
      dispose: async () => {},
      isAvailable: async () => isAvailable,
    } as ICapabilityAdapter),
  }
}

describe('PolicyBasedCapabilityNegotiator', () => {
  it('selects highest priority available adapter', async () => {
    const negotiator = new PolicyBasedCapabilityNegotiator()
    const candidates = [
      makeMockRegistration('LowPriorityAdapter', 1, ['windows']),
      makeMockRegistration('HighPriorityAdapter', 10, ['windows']),
      makeMockRegistration('MediumPriorityAdapter', 5, ['windows']),
    ]

    const result = await negotiator.negotiate({
      task: { id: 't1', requiredCapability: 'navigate_website' } as any,
      blueprint: {} as any,
      platform: 'windows',
      candidates,
    })

    expect(result.selected.name).toBe('HighPriorityAdapter')
    expect(result.candidatesEvaluated).toBe(3)
    expect(result.fallbackCandidates.length).toBe(2)
  })

  it('filters out platform-incompatible candidates', async () => {
    const negotiator = new PolicyBasedCapabilityNegotiator()
    const candidates = [
      makeMockRegistration('MacOnlyAdapter', 10, ['macos']),
      makeMockRegistration('WindowsAdapter', 5, ['windows']),
    ]

    const result = await negotiator.negotiate({
      task: { id: 't1', requiredCapability: 'navigate_website' } as any,
      blueprint: {} as any,
      platform: 'windows',
      candidates,
    })

    expect(result.selected.name).toBe('WindowsAdapter')
  })

  it('filters out unavailable candidates when available ones exist', async () => {
    const negotiator = new PolicyBasedCapabilityNegotiator()
    const candidates = [
      makeMockRegistration('OfflineHighPriorityAdapter', 10, ['windows'], false),
      makeMockRegistration('OnlineLowPriorityAdapter', 2, ['windows'], true),
    ]

    const result = await negotiator.negotiate({
      task: { id: 't1', requiredCapability: 'navigate_website' } as any,
      blueprint: {} as any,
      platform: 'windows',
      candidates,
    })

    expect(result.selected.name).toBe('OnlineLowPriorityAdapter')
  })
})
