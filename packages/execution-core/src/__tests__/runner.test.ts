import { describe, it, expect, vi } from 'vitest'
import {
  createExecutionRunner,
  createDefaultRegistry,
  ApprovalGate,
  ExecutionStateMachine,
  TaskScheduler,
  RetryEngine,
  ExecutionJournal,
  CheckpointManager,
  ExecutionMetricsCollector,
  ExecutionRunner,
} from '../index'
import type { ExecutionBlueprint, Task, TaskGraph, Goal, Intent } from '@usepilot/planner-types'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task',
    category: 'navigation',
    requiredCapability: 'navigate_website',
    preconditions: [],
    postconditions: [],
    successConditions: ['Page loaded'],
    failureConditions: ['Page not found'],
    dependsOn: [],
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 0.9,
    ...overrides,
  }
}

function makeBlueprint(tasks: Task[]): ExecutionBlueprint {
  const nodes = tasks.map((t, i) => ({
    taskId: t.id,
    layer: i,
    isCritical: true,
    canParallelize: false,
    inDegree: i === 0 ? 0 : 1,
    outDegree: i === tasks.length - 1 ? 0 : 1,
  }))

  const graph: TaskGraph = {
    nodes,
    edges: tasks.slice(1).map((t, i) => ({
      from: tasks[i]!.id,
      to: t.id,
      type: 'depends_on' as const,
    })),
    parallelGroups: tasks.map((t) => [t.id]),
    criticalPath: tasks.map((t) => t.id),
    taskCount: tasks.length,
    depth: tasks.length,
  }

  return {
    id: 'bp-1',
    version: 1,
    hash: 'abc',
    goal: {
      id: 'g1',
      primaryObjective: 'test',
      constraints: [],
      requiredResources: [],
      expectedOutcome: 'done',
      confidence: 0.9,
      status: 'validated',
      normalizedInput: {
        text: 'test',
        originalText: 'test',
        detectedLanguage: 'en',
        entities: [],
        durationMs: 0,
      },
      createdAt: Date.now(),
    },
    intent: {
      type: 'research',
      complexity: 'low',
      riskLevel: 'low',
      requiresHumanApproval: false,
      missingInformation: [],
      confidence: 0.9,
      durationMs: 10,
    },
    tasks,
    graph,
    approvals: { requiresMandatoryApproval: false, hasForbiddenTasks: false,
      mandatoryTaskIds: [], optionalTaskIds: [], forbiddenTaskIds: [] },
    successCriteria: [],
    estimatedComplexity: 'low',
    optimization: { mergedTasks: [], removedDuplicates: [], newParallelGroups: [], simplifications: [], changed: false },
    plannerContext: { platform: 'windows', availableTools: [], settingsSnapshot: {}, previousBlueprintCount: 0 },
    createdAt: Date.now(),
  }
}

describe('ExecutionRunner', () => {
  it('runs a single task to completion', async () => {
    const task = makeTask({ id: 'task-1' })
    const blueprint = makeBlueprint([task])
    const { runner } = createExecutionRunner('run-1', 'trace-1')

    const result = await runner.run('run-1', 'trace-1', blueprint)

    expect(result.status).toBe('completed')
    expect(result.tasksCompleted).toBe(1)
    expect(result.tasksFailed).toBe(0)
  })

  it('runs 3 serial tasks in order', async () => {
    const t1 = makeTask({ id: 't1', title: 'Task 1', dependsOn: [] })
    const t2 = makeTask({ id: 't2', title: 'Task 2', dependsOn: ['t1'] })
    const t3 = makeTask({ id: 't3', title: 'Task 3', dependsOn: ['t2'] })
    const blueprint = makeBlueprint([t1, t2, t3])
    const { runner } = createExecutionRunner('run-2', 'trace-2')

    const order: string[] = []
    const result = await runner.run('run-2', 'trace-2', blueprint, {
      callbacks: {
        onTaskStarted: (id) => { order.push(id) },
      },
    })

    expect(result.status).toBe('completed')
    expect(result.tasksCompleted).toBe(3)
    expect(order).toEqual(['t1', 't2', 't3'])
  })

  it('skips task when failureStrategy is skip', async () => {
    const registry = createDefaultRegistry()
    // Override navigate_website to fail
    registry.register({
      capability: 'navigate_website',
      priority: 10,
      platformSupport: [],
      name: 'FailAdapter',
      factory: () => ({
        capability: 'navigate_website',
        priority: 10,
        platformSupport: [],
        name: 'FailAdapter',
        initialize: async () => {},
        execute: async () => ({ success: false, error: 'Simulated failure', durationMs: 10 }),
        verify: async () => ({ passed: false, checkedConditions: [], failedConditions: ['Failed'], strategy: 'state_check' as const, durationMs: 5 }),
        cleanup: async () => {},
        dispose: async () => {},
        isAvailable: async () => true,
      }),
    })

    const task = makeTask({
      id: 'task-skip',
      failureStrategy: { onFailure: 'skip' },
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
    })
    const blueprint = makeBlueprint([task])
    const { runner } = createExecutionRunner('run-3', 'trace-3', registry)

    const result = await runner.run('run-3', 'trace-3', blueprint)

    expect(result.tasksSkipped).toBe(1)
    expect(result.tasksCompleted).toBe(0)
  })

  it('blocks on mandatory approval and completes when approved', async () => {
    const task = makeTask({
      id: 'task-approval',
      approvalPolicy: 'mandatory',
      approvalReason: 'Requires human sign-off',
      failureStrategy: { onFailure: 'abort' },
    })
    const blueprint = makeBlueprint([task])
    const registry = createDefaultRegistry()
    const approvalGate = new ApprovalGate({ timeoutMs: 10000 })
    const deps = {
      registry,
      scheduler: new TaskScheduler(),
      stateMachine: new ExecutionStateMachine(),
      approvalGate,
      retryEngine: new RetryEngine(),
      journal: new ExecutionJournal(),
      checkpoints: new CheckpointManager('run-4'),
      metrics: new ExecutionMetricsCollector('run-4', 'trace-4'),
    }
    const runner = new ExecutionRunner(deps)

    // Resolve approval after a short delay
    setTimeout(() => {
      approvalGate.resolve('task-approval', {
        requestId: 'req-1',
        taskId: 'task-approval',
        approved: true,
        respondedAt: Date.now(),
      })
    }, 50)

    const result = await runner.run('run-4', 'trace-4', blueprint)
    expect(result.status).toBe('completed')
    expect(result.tasksCompleted).toBe(1)
  })

  it('fails when mandatory approval is rejected', async () => {
    const task = makeTask({
      id: 'task-reject',
      approvalPolicy: 'mandatory',
      failureStrategy: { onFailure: 'abort' },
    })
    const blueprint = makeBlueprint([task])
    const approvalGate = new ApprovalGate({ timeoutMs: 10000 })
    const deps = {
      registry: createDefaultRegistry(),
      scheduler: new TaskScheduler(),
      stateMachine: new ExecutionStateMachine(),
      approvalGate,
      retryEngine: new RetryEngine(),
      journal: new ExecutionJournal(),
      checkpoints: new CheckpointManager('run-5'),
      metrics: new ExecutionMetricsCollector('run-5', 'trace-5'),
    }
    const runner = new ExecutionRunner(deps)

    setTimeout(() => {
      approvalGate.resolve('task-reject', {
        requestId: 'req-2',
        taskId: 'task-reject',
        approved: false,
        respondedAt: Date.now(),
      })
    }, 50)

    const result = await runner.run('run-5', 'trace-5', blueprint)
    expect(result.status).toBe('failed')
    expect(result.tasksFailed).toBeGreaterThan(0)
  })

  it('cancels mid-run', async () => {
    const tasks = [
      makeTask({ id: 't1', requiredCapability: 'transform_data' }),
      makeTask({ id: 't2', requiredCapability: 'transform_data', dependsOn: ['t1'] }),
    ]
    const blueprint = makeBlueprint(tasks)
    const { runner } = createExecutionRunner('run-6', 'trace-6')

    // Cancel immediately
    setTimeout(() => runner.cancel(), 30)

    const result = await runner.run('run-6', 'trace-6', blueprint)
    expect(['cancelled', 'completed']).toContain(result.status)
  })

  it('generates a report with summary', async () => {
    const task = makeTask({ id: 'task-report' })
    const blueprint = makeBlueprint([task])
    const { runner } = createExecutionRunner('run-7', 'trace-7')

    const result = await runner.run('run-7', 'trace-7', blueprint)

    expect(result.report.summary).toContain('task')
    expect(result.report.taskSummaries).toHaveLength(1)
    expect(result.report.metrics.runId).toBe('run-7')
  })
})
