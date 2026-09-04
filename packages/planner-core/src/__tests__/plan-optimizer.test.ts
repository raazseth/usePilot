import { describe, it, expect } from 'vitest'
import { PlanOptimizer } from '../optimizer/plan-optimizer'
import { GraphBuilder } from '../graph/builder'
import type { Task } from '@usepilot/planner-types'

function makeTask(id: string, title: string, tool: any, dependsOn: string[] = []): Task {
  return {
    id,
    title,
    description: `Description for ${title}`,
    category: 'computation',
    requiredCapability: 'none',
    requiredTool: tool,
    preconditions: [],
    postconditions: [],
    successConditions: [`${title} succeeded`],
    failureConditions: [],
    dependsOn,
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 1000, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 1.0,
  }
}

describe('PlanOptimizer', () => {
  const optimizer = new PlanOptimizer()
  const graphBuilder = new GraphBuilder()

  it('removes duplicate tasks with matching title and tool', () => {
    const tasks = [
      makeTask('t-1', 'Open browser tab', 'browser', []),
      makeTask('t-2', 'Open browser tab', 'browser', ['t-1']),
    ]
    const graph = graphBuilder.build(tasks)

    const result = optimizer.optimize(tasks, graph)
    expect(result.optimization.removedDuplicates).toContain('t-2')
    expect(result.tasks).toHaveLength(1)
  })

  it('merges sequential automatic tasks using the same tool', () => {
    const tasks = [
      makeTask('t-1', 'Click login button', 'browser', []),
      makeTask('t-2', 'Wait for dashboard to load', 'browser', ['t-1']),
    ]
    const graph = graphBuilder.build(tasks)

    const result = optimizer.optimize(tasks, graph)
    expect(result.optimization.mergedTasks).toHaveLength(1)
    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0]?.description).toContain('Then: Description for Wait for dashboard to load')
  })
})
