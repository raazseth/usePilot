import { describe, it, expect } from 'vitest'
import { GraphBuilder } from '../graph/builder'
import type { Task } from '@usepilot/planner-types'

function makeTask(id: string, dependsOn: string[] = []): Task {
  return {
    id,
    title: `Task ${id}`,
    description: `Task description for ${id}`,
    category: 'computation',
    requiredCapability: 'none',
    requiredTool: 'none',
    preconditions: [],
    postconditions: [],
    successConditions: [],
    failureConditions: [],
    dependsOn,
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 1000, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 1.0,
  }
}

describe('GraphBuilder', () => {
  const builder = new GraphBuilder()

  it('builds a linear DAG correctly', () => {
    const tasks = [
      makeTask('t-1', []),
      makeTask('t-2', ['t-1']),
      makeTask('t-3', ['t-2']),
    ]

    const graph = builder.build(tasks)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toHaveLength(2)
    expect(graph.edges[0]).toEqual({ from: 't-1', to: 't-2', type: 'depends_on' })
    expect(graph.edges[1]).toEqual({ from: 't-2', to: 't-3', type: 'depends_on' })
  })

  it('identifies parallel groups for independent tasks', () => {
    const tasks = [
      makeTask('root', []),
      makeTask('child-a', ['root']),
      makeTask('child-b', ['root']),
      makeTask('final', ['child-a', 'child-b']),
    ]

    const graph = builder.build(tasks)
    expect(graph.parallelGroups.some((group) => group.includes('child-a') && group.includes('child-b'))).toBe(true)
  })

  it('throws an error on circular dependencies', () => {
    const tasks = [
      makeTask('t-1', ['t-2']),
      makeTask('t-2', ['t-1']),
    ]

    expect(() => builder.build(tasks)).toThrow(/cycle|circular/i)
  })
})
