import { describe, it, expect } from 'vitest'
import { ManifestGenerator } from '../manifest/generator'
import { createDefaultExecutionPolicy } from '../policy/engine'
import { createExecutionRunner, createDefaultRegistry } from '../index'
import type { ExecutionBlueprint, Task } from '@usepilot/planner-types'

function makeMockBlueprint(): ExecutionBlueprint {
  const task: Task = {
    id: 't-1',
    title: 'Run command',
    description: 'Test command task',
    category: 'computation',
    requiredCapability: 'execute_command',
    complexity: 'low',
    confidence: 1,
    dependsOn: [],
    preconditions: [],
    postconditions: [],
    successConditions: [],
    failureConditions: [],
    approvalPolicy: 'automatic',
    failureStrategy: { onFailure: 'abort' },
    retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
  }

  return {
    id: 'bp-manifest-test',
    hash: 'deadbeef12345678',
    version: 1,
    tasks: [task],
    graph: {
      nodes: [{ taskId: 't-1', layer: 0, isCritical: true, canParallelize: false, inDegree: 0, outDegree: 0 }],
      edges: [],
      parallelGroups: [['t-1']],
      criticalPath: ['t-1'],
      taskCount: 1,
      depth: 1,
    },
    estimatedComplexity: 'low',
    estimatedRisk: 'low',
    explanation: { overview: 'test', taskRationales: {}, estimatedTotalDurationMs: 100 },
    userClarifications: [],
    successCriteria: [],
    createdAt: Date.now(),
  } as unknown as ExecutionBlueprint
}

describe('ManifestGenerator', () => {
  it('generates a deterministic SHA-256 hash across identical inputs', async () => {
    const policy = createDefaultExecutionPolicy()
    const input = {
      runId: 'run-123',
      traceId: 'trace-456',
      blueprintHash: 'bp-hash-789',
      policy,
      capabilities: ['execute_command'],
      selectedAdapters: [{ taskId: 't-1', capability: 'execute_command', adapterName: 'StubAdapter' }],
      environment: { os: 'windows', arch: 'x64', runtime: 'node' },
      startedAt: 1000,
      completedAt: 2000,
      tasksSummary: { total: 1, completed: 1, failed: 0, skipped: 0 },
      outcome: 'success' as const,
    }

    const m1 = await ManifestGenerator.generate(input)
    const m2 = await ManifestGenerator.generate({ ...input, manifestId: 'custom-id' } as any)

    expect(m1.manifestHash).toBe(m2.manifestHash)
    expect(m1.manifestHash.length).toBe(64)
  })

  it('detects changes in outcome or tasks (tamper-evident)', async () => {
    const policy = createDefaultExecutionPolicy()
    const base = {
      runId: 'run-123',
      traceId: 'trace-456',
      blueprintHash: 'bp-hash-789',
      policy,
      capabilities: ['execute_command'],
      selectedAdapters: [{ taskId: 't-1', capability: 'execute_command', adapterName: 'StubAdapter' }],
      environment: { os: 'windows', arch: 'x64', runtime: 'node' },
      startedAt: 1000,
      completedAt: 2000,
      tasksSummary: { total: 1, completed: 1, failed: 0, skipped: 0 },
      outcome: 'success' as const,
    }

    const mSuccess = await ManifestGenerator.generate(base)
    const mFailed = await ManifestGenerator.generate({ ...base, outcome: 'failed' })

    expect(mSuccess.manifestHash).not.toBe(mFailed.manifestHash)
  })

  it('ExecutionRunner produces an immutable manifest on completion', async () => {
    const registry = createDefaultRegistry()
    const { runner } = createExecutionRunner('run-manifest', 'trace-manifest', registry)
    const blueprint = makeMockBlueprint()

    const result = await runner.run('run-manifest', 'trace-manifest', blueprint)

    expect(result.manifest).toBeDefined()
    expect(result.manifest?.blueprintHash).toBe(blueprint.hash)
    expect(result.manifest?.outcome).toBe('success')
    expect(result.manifest?.manifestHash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.manifest?.selectedAdapters.length).toBe(1)
  })
})
