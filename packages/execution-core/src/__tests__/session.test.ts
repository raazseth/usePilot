import type { AdapterContext } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { describe, it, expect, beforeEach } from 'vitest'

import { StubAdapter } from '../adapters/stub'
import { ExecutionResourceManager } from '../resource-manager'
import { SessionManager } from '../session/manager'
import { AdapterSession } from '../session/session'

function makeMockBlueprint(): ExecutionBlueprint {
  return {
    id: 'bp-1',
    hash: 'hash-1',
    version: 1,
    tasks: [],
    graph: { nodes: [], edges: [], parallelGroups: [], criticalPath: [], taskCount: 0, depth: 0 },
    estimatedComplexity: 'low',
    estimatedRisk: 'low',
    explanation: { overview: 'Test blueprint', taskRationales: {}, estimatedTotalDurationMs: 0 },
    userClarifications: [],
    successCriteria: [],
    createdAt: Date.now(),
  } as unknown as ExecutionBlueprint
}

function makeMockTask(id: string): Task {
  return {
    id,
    title: `Task ${id}`,
    description: 'Test session task',
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
    retryPolicy: { maxAttempts: 3, backoffMs: 10, exponential: false },
  }
}

describe('AdapterSession & SessionManager', () => {
  let blueprint: ExecutionBlueprint

  beforeEach(() => {
    blueprint = makeMockBlueprint()
  })

  it('tracks lifecycle metrics across multiple executions on the same session', async () => {
    const adapter = new StubAdapter('execute_command')
    const session = new AdapterSession('run-1', 'execute_command', adapter)
    const task1 = makeMockTask('task-1')
    const task2 = makeMockTask('task-2')

    const ctx1: AdapterContext = {
      task: task1,
      blueprint,
      runId: 'run-1',
      traceId: 'trace-1',
      signal: new AbortController().signal,
    }

    const res1 = await session.execute(ctx1)
    expect(res1.adapterResult.success).toBe(true)
    expect(session.lifecycle.tasksExecuted).toBe(1)
    expect(session.lifecycle.errorCount).toBe(0)
    expect(session.status).toBe('idle')

    const ctx2: AdapterContext = {
      task: task2,
      blueprint,
      runId: 'run-1',
      traceId: 'trace-1',
      signal: new AbortController().signal,
    }

    const res2 = await session.execute(ctx2)
    expect(res2.adapterResult.success).toBe(true)
    expect(session.lifecycle.tasksExecuted).toBe(2)
    expect(session.lifecycle.errorCount).toBe(0)

    await session.close()
    expect(session.status).toBe('closed')
  })

  it('recovers from errors via session.recover()', async () => {
    let initialized = false
    const failingAdapter = {
      capability: 'execute_command' as const,
      priority: 0,
      platformSupport: [],
      name: 'FailingAdapter',
      initialize: async () => { initialized = true },
      execute: async () => ({
        success: false,
        error: 'Simulated failure',
        durationMs: 10,
        failureCategory: 'adapter_failure' as const,
      }),
      verify: async () => ({
        passed: false,
        checkedConditions: [],
        failedConditions: [],
        strategy: 'state_check' as const,
        durationMs: 0,
      }),
      cleanup: async () => {},
      dispose: async () => {},
      isAvailable: async () => true,
    }

    const session = new AdapterSession('run-1', 'execute_command', failingAdapter)
    const task = makeMockTask('task-fail')

    const ctx: AdapterContext = {
      task,
      blueprint,
      runId: 'run-1',
      traceId: 'trace-1',
      signal: new AbortController().signal,
    }

    const res = await session.execute(ctx)
    expect(res.adapterResult.success).toBe(false)
    expect(session.lifecycle.errorCount).toBe(1)

    const recovered = await session.recover()
    expect(recovered).toBe(true)
    expect(session.status).toBe('idle')
    expect(initialized).toBe(true)

    await session.close()
  })

  it('SessionManager reuses session for same capability under capability scope', async () => {
    const resourceManager = new ExecutionResourceManager()
    const sessionManager = new SessionManager({ defaultScope: 'capability' }, { resourceManager })

    const adapter1 = new StubAdapter('execute_command')
    const adapter2 = new StubAdapter('execute_command')

    const session1 = await sessionManager.getOrCreateSession('run-1', 'execute_command', adapter1)
    const session2 = await sessionManager.getOrCreateSession('run-1', 'execute_command', adapter2)

    expect(session1.id).toBe(session2.id)
    expect(sessionManager.listActiveSessions().length).toBe(1)

    await sessionManager.closeAll()
    expect(sessionManager.listActiveSessions().length).toBe(0)
  })

  it('SessionManager creates isolated sessions when scope is task', async () => {
    const sessionManager = new SessionManager({ defaultScope: 'task' })
    const adapter1 = new StubAdapter('execute_command')
    const adapter2 = new StubAdapter('execute_command')

    const session1 = await sessionManager.getOrCreateSession('run-1', 'execute_command', adapter1, 'task')
    const session2 = await sessionManager.getOrCreateSession('run-1', 'execute_command', adapter2, 'task')

    expect(session1.id).not.toBe(session2.id)
    expect(sessionManager.listActiveSessions().length).toBe(2)

    await sessionManager.closeAll()
  })
})
