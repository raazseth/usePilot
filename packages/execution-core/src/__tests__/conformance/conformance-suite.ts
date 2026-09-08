import type { ICapabilityAdapter, AdapterContext } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { describe, it, expect } from 'vitest'

export interface ConformanceSuiteOptions {
  createAdapter: () => Promise<ICapabilityAdapter> | ICapabilityAdapter
  sampleTask: Task
  blueprint: ExecutionBlueprint
}

export function runAdapterConformanceSuite(suiteName: string, options: ConformanceSuiteOptions): void {
  describe(`Adapter Conformance: ${suiteName}`, () => {
    it('implements lifecycle protocols: initialize, isAvailable, cleanup, dispose', async () => {
      const adapter = await options.createAdapter()
      await expect(adapter.initialize()).resolves.toBeUndefined()
      await expect(adapter.isAvailable()).resolves.toBe(true)
      await expect(adapter.cleanup()).resolves.toBeUndefined()
      await expect(adapter.dispose()).resolves.toBeUndefined()
    })

    it('executes task and returns compliant AdapterResult', async () => {
      const adapter = await options.createAdapter()
      await adapter.initialize()

      const controller = new AbortController()
      const ctx: AdapterContext = {
        task: options.sampleTask,
        blueprint: options.blueprint,
        runId: 'conformance-run-1',
        traceId: 'conformance-trace-1',
        signal: controller.signal,
      }

      const result = await adapter.execute(ctx)
      expect(result).toBeDefined()
      expect(typeof result.success).toBe('boolean')
      expect(typeof result.durationMs).toBe('number')
      expect(result.durationMs).toBeGreaterThanOrEqual(0)

      await adapter.cleanup()
      await adapter.dispose()
    })

    it('verifies execution independently via verify()', async () => {
      const adapter = await options.createAdapter()
      await adapter.initialize()

      const controller = new AbortController()
      const ctx: AdapterContext = {
        task: options.sampleTask,
        blueprint: options.blueprint,
        runId: 'conformance-run-2',
        traceId: 'conformance-trace-2',
        signal: controller.signal,
      }

      const result = await adapter.execute(ctx)
      const verification = await adapter.verify(ctx, result)

      expect(verification).toBeDefined()
      expect(typeof verification.passed).toBe('boolean')
      expect(Array.isArray(verification.checkedConditions)).toBe(true)
      expect(Array.isArray(verification.failedConditions)).toBe(true)

      await adapter.cleanup()
      await adapter.dispose()
    })

    it('respects cooperative cancellation signal', async () => {
      const adapter = await options.createAdapter()
      await adapter.initialize()

      const controller = new AbortController()
      controller.abort() // Pre-aborted

      const ctx: AdapterContext = {
        task: options.sampleTask,
        blueprint: options.blueprint,
        runId: 'conformance-run-abort',
        traceId: 'conformance-trace-abort',
        signal: controller.signal,
      }

      const result = await adapter.execute(ctx)
      expect(result.success).toBe(false)
      expect(result.failureCategory).toBe('cancellation')

      await adapter.cleanup()
      await adapter.dispose()
    })
  })
}
