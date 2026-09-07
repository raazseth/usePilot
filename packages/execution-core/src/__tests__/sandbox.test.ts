import { describe, it, expect } from 'vitest'
import { AdapterSandbox } from '../sandbox'
import type { ICapabilityAdapter, AdapterContext } from '@usepilot/execution-types'

function makeMockAdapter(overrides: Partial<ICapabilityAdapter> = {}): ICapabilityAdapter {
  return {
    capability: 'navigate_website',
    priority: 1,
    platformSupport: [],
    name: 'MockAdapter',
    initialize: async () => {},
    execute: async () => ({ success: true, durationMs: 10, output: 'done' }),
    verify: async () => ({ passed: true, checkedConditions: [], failedConditions: [], strategy: 'state_check', durationMs: 1 }),
    cleanup: async () => {},
    dispose: async () => {},
    isAvailable: async () => true,
    ...overrides,
  }
}

function makeMockContext(signal = new AbortController().signal): AdapterContext {
  return {
    task: {
      id: 't1', title: 'Task', description: '', category: 'navigation',
      requiredCapability: 'navigate_website', preconditions: [], postconditions: [],
      successConditions: [], failureConditions: [], dependsOn: [],
      approvalPolicy: 'automatic', complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' }, confidence: 0.9,
    },
    blueprint: {} as any,
    runId: 'r1',
    traceId: 'tr1',
    signal,
  }
}

describe('AdapterSandbox', () => {
  it('executes successfully and captures logs', async () => {
    const sandbox = new AdapterSandbox({ captureOutput: true })
    const adapter = makeMockAdapter()
    const ctx = makeMockContext()

    const result = await sandbox.execute(adapter, ctx)
    expect(result.adapterResult.success).toBe(true)
    expect(result.panicked).toBe(false)
    expect(result.logs.length).toBeGreaterThan(0)
  })

  it('recovers from synchronous panic in adapter.execute', async () => {
    const sandbox = new AdapterSandbox()
    const adapter = makeMockAdapter({
      execute: () => {
        throw new Error('Fatal native exception!')
      },
    })
    const ctx = makeMockContext()

    const result = await sandbox.execute(adapter, ctx)
    expect(result.adapterResult.success).toBe(false)
    expect(result.adapterResult.failureCategory).toBe('adapter_failure')
    expect(result.panicked).toBe(true)
    expect(result.panicError).toContain('Fatal native exception!')
  })

  it('enforces execution timeout', async () => {
    const sandbox = new AdapterSandbox({ timeoutMs: 50 })
    const adapter = makeMockAdapter({
      execute: async () => {
        await new Promise((r) => setTimeout(r, 500))
        return { success: true, durationMs: 500 }
      },
    })
    const ctx = makeMockContext()

    const result = await sandbox.execute(adapter, ctx)
    expect(result.adapterResult.success).toBe(false)
    expect(result.adapterResult.failureCategory).toBe('timeout')
    expect(result.panicked).toBe(true)
  })

  it('guarantees adapter cleanup and disposal even on panic', async () => {
    let cleanedUp = false
    let disposed = false

    const sandbox = new AdapterSandbox()
    const adapter = makeMockAdapter({
      execute: () => {
        throw new Error('Crash!')
      },
      cleanup: async () => {
        cleanedUp = true
      },
      dispose: async () => {
        disposed = true
      },
    })
    const ctx = makeMockContext()

    await sandbox.execute(adapter, ctx)
    expect(cleanedUp).toBe(true)
    expect(disposed).toBe(true)
  })
})
