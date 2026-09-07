import { describe, it, expect } from 'vitest'
import { TaskScheduler } from '../scheduler'
import type { ExecutionBlueprint, Task, TaskGraph } from '@usepilot/planner-types'

function makeBlueprint(tasks: Task[], parallelGroups: string[][]): ExecutionBlueprint {
  const nodes = tasks.map((t, i) => ({
    taskId: t.id, layer: i, isCritical: true, canParallelize: parallelGroups.some(g => g.includes(t.id) && g.length > 1),
    inDegree: i === 0 ? 0 : 1, outDegree: i === tasks.length - 1 ? 0 : 1,
  }))
  const graph: TaskGraph = {
    nodes, edges: [], parallelGroups,
    criticalPath: tasks.map(t => t.id), taskCount: tasks.length, depth: tasks.length,
  }
  return {
    id: 'bp', version: 1, hash: 'h',
    goal: {
      id: 'g',
      primaryObjective: '',
      constraints: [],
      requiredResources: [],
      expectedOutcome: '',
      confidence: 0.9,
      status: 'validated',
      normalizedInput: {
        text: '',
        originalText: '',
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
    tasks, graph,
    approvals: { requiresMandatoryApproval: false, hasForbiddenTasks: false, mandatoryTaskIds: [], optionalTaskIds: [], forbiddenTaskIds: [] },
    successCriteria: [], estimatedComplexity: 'low',
    optimization: { mergedTasks: [], removedDuplicates: [], newParallelGroups: [], simplifications: [], changed: false },
    plannerContext: { platform: 'windows', availableTools: [], settingsSnapshot: {}, previousBlueprintCount: 0 },
    createdAt: Date.now(),
  } as ExecutionBlueprint
}

function makeTask(id: string, policy: Task['approvalPolicy'] = 'automatic'): Task {
  return {
    id, title: id, description: '', category: 'computation',
    requiredCapability: 'transform_data', preconditions: [], postconditions: [],
    successConditions: [], failureConditions: [], dependsOn: [],
    approvalPolicy: policy, complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
    failureStrategy: { onFailure: 'abort' }, confidence: 0.9,
  }
}

describe('TaskScheduler', () => {
  it('returns single batch for single task', () => {
    const t = makeTask('t1')
    const bp = makeBlueprint([t], [['t1']])
    const batches = new TaskScheduler().schedule(bp)
    expect(batches).toHaveLength(1)
    expect(batches[0]!.tasks).toHaveLength(1)
    expect(batches[0]!.canParallelize).toBe(false)
  })

  it('groups 2 independent tasks as parallel', () => {
    const t1 = makeTask('t1')
    const t2 = makeTask('t2')
    const bp = makeBlueprint([t1, t2], [['t1', 't2']])
    const batches = new TaskScheduler().schedule(bp)
    expect(batches).toHaveLength(1)
    expect(batches[0]!.canParallelize).toBe(true)
    expect(batches[0]!.tasks).toHaveLength(2)
  })

  it('splits mandatory tasks into individual serial batches', () => {
    const t1 = makeTask('t1', 'mandatory')
    const t2 = makeTask('t2', 'automatic')
    const bp = makeBlueprint([t1, t2], [['t1', 't2']])
    const batches = new TaskScheduler().schedule(bp)
    // t1 mandatory — split into own batch
    const mandatoryBatches = batches.filter(b => b.tasks.some(t => t.approvalPolicy === 'mandatory'))
    expect(mandatoryBatches.every(b => !b.canParallelize)).toBe(true)
  })

  it('returns task IDs in topological order', () => {
    const t1 = makeTask('t1')
    const t2 = makeTask('t2')
    const t3 = makeTask('t3')
    const bp = makeBlueprint([t1, t2, t3], [['t1'], ['t2'], ['t3']])
    const order = new TaskScheduler().getExecutionOrder(bp)
    expect(order).toEqual(['t1', 't2', 't3'])
  })
})
