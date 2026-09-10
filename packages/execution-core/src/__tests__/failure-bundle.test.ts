import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import { ArtifactManager } from '../artifacts/artifact-manager'
import { ArtifactStore } from '../artifacts/artifact-store'
import { PerformanceMetricsCollector } from '../diagnostics/performance-collector'
import { RuntimeLogger } from '../logging/runtime-logger'
import { FailureBundleGenerator } from '../replay/failure-bundle'

describe('Failure Bundle, Performance Metrics & Runtime Logger', () => {
  const testDir = join(tmpdir(), `test-fail-bundle-${Date.now()}`)
  const store = new ArtifactStore(testDir)
  const manager = new ArtifactManager(store)
  const executionId = 'run-fail-bundle-123'

  it('FailureBundleGenerator packages diagnostic manifest and registers report artifact', async () => {
    const generator = new FailureBundleGenerator(manager)

    // Pre-populate an artifact
    await manager.captureScreenshot(executionId, 'task-err-1', Buffer.from('error-screenshot'))

    const bundleResult = await generator.generateBundle({
      executionId,
      failureReason: 'Selector #checkout-submit timed out after 30000ms',
      failedTaskId: 'task-err-1',
      journalEntries: [
        {
          id: 'j-err-1',
          runId: executionId,
          traceId: 'tr-err-1',
          taskId: 'task-err-1',
          eventType: 'task_failed',
          payload: { error: 'TimeoutError' },
          timestamp: Date.now(),
        },
      ],
      verificationFailures: [
        { taskId: 'task-err-1', error: 'Element never became visible', timestamp: Date.now() },
      ],
    })

    expect(bundleResult.bundleDir).toContain('failure-bundle')
    expect(bundleResult.manifest.failureReason).toContain('Selector #checkout-submit')
    expect(bundleResult.manifest.failedTaskId).toBe('task-err-1')
    expect(bundleResult.manifest.artifacts.length).toBeGreaterThanOrEqual(1)

    // Verify bundle manifest artifact was saved in store
    const reports = await store.list({ executionId, category: 'reports' })
    expect(reports.some((r) => r.uri.endsWith('failure-bundle-manifest.json'))).toBe(true)
  })

  it('PerformanceMetricsCollector records task metrics and aggregates breakdowns', () => {
    const collector = new PerformanceMetricsCollector(executionId)

    collector.recordTask({
      taskId: 't-1',
      capability: 'navigate_website',
      adapterId: 'PlaywrightBrowserAdapter',
      durationMs: 450,
      verificationDurationMs: 50,
      retries: 0,
      healingAttempts: 0,
      approvalWaitMs: 0,
      artifactsCount: 1,
    })

    collector.recordTask({
      taskId: 't-2',
      capability: 'write_file',
      adapterId: 'NativeFilesystemAdapter',
      durationMs: 120,
      verificationDurationMs: 20,
      retries: 1,
      healingAttempts: 0,
      approvalWaitMs: 0,
      artifactsCount: 1,
    })

    const summary = collector.finish()
    expect(summary.executionId).toBe(executionId)
    expect(summary.taskCount).toBe(2)
    expect(summary.retriesTotal).toBe(1)
    expect(summary.verificationDurationMsTotal).toBe(70)
    expect(summary.artifactsProducedTotal).toBe(2)
    expect(summary.capabilityBreakdown['navigate_website']?.count).toBe(1)
    expect(summary.adapterBreakdown['NativeFilesystemAdapter']?.avgDurationMs).toBe(120)
  })

  it('RuntimeLogger logs structured entries, searches, and flushes to ArtifactStore', async () => {
    const logger = new RuntimeLogger(manager)

    logger.info(executionId, 'EXECUTION_START', 'Execution starting', { taskId: 't-1' })
    logger.debug(executionId, 'DOM_INSPECT', 'Inspecting page DOM elements', { taskId: 't-1' })
    logger.warn(executionId, 'HEALING_ATTEMPT', 'DOM selector failed, falling back to semantic', { taskId: 't-1' })
    logger.error(executionId, 'VERIFY_FAIL', 'Verification checksum mismatch', { taskId: 't-2' })

    const errors = logger.search({ level: 'ERROR' })
    expect(errors.length).toBe(1)
    expect(errors[0]?.event).toBe('VERIFY_FAIL')

    const task1Logs = logger.search({ taskId: 't-1' })
    expect(task1Logs.length).toBe(3)

    await logger.flushToArtifactStore(executionId)
    const logArtifacts = await store.list({ executionId, category: 'logs' })
    expect(logArtifacts.length).toBe(1)
    expect(logArtifacts[0]?.uri.endsWith('execution.log')).toBe(true)
  })
})
