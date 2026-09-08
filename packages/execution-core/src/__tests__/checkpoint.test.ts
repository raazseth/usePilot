import { describe, it, expect } from 'vitest'

import { CheckpointManager, InMemoryCheckpointBackend } from '../checkpoint'

describe('CheckpointManager', () => {
  it('saves and restores checkpoint', async () => {
    const backend = new InMemoryCheckpointBackend()
    const mgr = new CheckpointManager('run-1', backend)

    await mgr.save({
      executionStatus: 'running',
      completedTaskIds: ['t1'],
      pendingTaskIds: ['t2', 't3'],
      failedTaskIds: [],
      skippedTaskIds: [],
      retryCounters: { t1: 1 },
    })

    const restored = await mgr.restore()
    expect(restored).not.toBeNull()
    expect(restored!.completedTaskIds).toContain('t1')
    expect(restored!.pendingTaskIds).toContain('t2')
    expect(restored!.retryCounters['t1']).toBe(1)
  })

  it('returns null when no checkpoint exists', async () => {
    const mgr = new CheckpointManager('run-empty')
    const restored = await mgr.restore()
    expect(restored).toBeNull()
  })

  it('tracks checkpoint count', async () => {
    const mgr = new CheckpointManager('run-2')
    await mgr.save({ executionStatus: 'running', completedTaskIds: [], pendingTaskIds: [], failedTaskIds: [], skippedTaskIds: [], retryCounters: {} })
    await mgr.save({ executionStatus: 'running', completedTaskIds: ['t1'], pendingTaskIds: [], failedTaskIds: [], skippedTaskIds: [], retryCounters: {} })
    expect(mgr.getCount()).toBe(2)
  })

  it('always restores the latest checkpoint', async () => {
    const backend = new InMemoryCheckpointBackend()
    const mgr = new CheckpointManager('run-3', backend)

    await mgr.save({ executionStatus: 'running', completedTaskIds: ['t1'], pendingTaskIds: ['t2'], failedTaskIds: [], skippedTaskIds: [], retryCounters: {} })
    await mgr.save({ executionStatus: 'running', completedTaskIds: ['t1', 't2'], pendingTaskIds: ['t3'], failedTaskIds: [], skippedTaskIds: [], retryCounters: {} })

    const latest = await mgr.restore()
    expect(latest!.completedTaskIds).toContain('t2')
    expect(latest!.pendingTaskIds).toContain('t3')
  })
})
