// ─────────────────────────────────────────────────────────────────────────────
// GraphBuilder
// Pure algorithm — no LLM. Converts a Task[] into an explicit DAG.
// Detects topological order, computes parallel groups, critical path.
// Throws if the graph contains cycles.
// ─────────────────────────────────────────────────────────────────────────────

import type { Task, TaskGraph, DAGNode, DAGEdge } from '@usepilot/planner-types'
import { PlannerError, PlannerErrorCode } from '../errors'

export class GraphBuilder {
  build(tasks: Task[]): TaskGraph {
    if (tasks.length === 0) {
      throw new PlannerError({
        message: 'Cannot build graph from empty task list',
        code: PlannerErrorCode.GraphBuildFailed,
        stage: 'building',
      })
    }

    const taskMap = new Map<string, Task>(tasks.map((t) => [t.id, t]))

    // Validate all dependency IDs exist
    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        if (!taskMap.has(depId)) {
          throw new PlannerError({
            message: `Task "${task.title}" depends on unknown task ID "${depId}"`,
            code: PlannerErrorCode.GraphBuildFailed,
            stage: 'building',
          })
        }
      }
    }

    // Build explicit edges
    const edges: DAGEdge[] = []
    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        edges.push({
          from: depId,
          to: task.id,
          type: 'depends_on',
        })
      }
    }

    // Topological sort (Kahn's algorithm)
    const { order, layers } = this.topologicalSort(tasks)

    // Detect critical path
    const criticalPath = this.computeCriticalPath(tasks, layers)

    // Build nodes with metadata
    const taskToLayer = new Map<string, number>()
    for (const [layerIndex, layerTasks] of layers.entries()) {
      for (const tid of layerTasks) {
        taskToLayer.set(tid, layerIndex)
      }
    }

    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    for (const task of tasks) {
      inDegree.set(task.id, task.dependsOn.length)
      outDegree.set(task.id, 0)
    }
    for (const edge of edges) {
      outDegree.set(edge.from, (outDegree.get(edge.from) ?? 0) + 1)
    }

    const criticalSet = new Set(criticalPath)
    const nodes: DAGNode[] = order.map((taskId) => {
      const layer = taskToLayer.get(taskId) ?? 0
      const layerTasks = layers[layer] ?? []
      const task = taskMap.get(taskId)
      const canParallelize = layerTasks.length > 1

      return {
        taskId,
        layer,
        isCritical: criticalSet.has(taskId),
        canParallelize,
        inDegree: inDegree.get(taskId) ?? 0,
        outDegree: outDegree.get(taskId) ?? 0,
        isOptional: task?.isOptional ?? false,
        estimatedComplexity: task?.complexity,
        expectedOutput: task?.expectedOutput,
        parallelGroupId: canParallelize ? `layer_${layer}` : undefined,
      }
    })

    // Build parallel groups (tasks in the same layer with no inter-dependencies)
    const parallelGroups: string[][] = layers
      .filter((layer) => layer.length > 1)
      .map((layer) => [...layer])

    return {
      nodes,
      edges,
      parallelGroups,
      criticalPath,
      taskCount: tasks.length,
      depth: layers.length,
    }
  }

  /**
   * Kahn's topological sort. Returns the sorted task IDs and the layer groups.
   * Throws if a cycle is detected.
   */
  private topologicalSort(
    tasks: Task[]
  ): { order: string[]; layers: string[][] } {
    const inDegree = new Map<string, number>()
    const successors = new Map<string, string[]>()

    for (const task of tasks) {
      inDegree.set(task.id, task.dependsOn.length)
      if (!successors.has(task.id)) successors.set(task.id, [])
    }
    for (const task of tasks) {
      for (const depId of task.dependsOn) {
        const succs = successors.get(depId)
        if (succs) succs.push(task.id)
      }
    }

    const order: string[] = []
    const layers: string[][] = []
    let queue = tasks.filter((t) => (inDegree.get(t.id) ?? 0) === 0).map((t) => t.id)

    while (queue.length > 0) {
      layers.push([...queue])
      const nextQueue: string[] = []
      for (const taskId of queue) {
        order.push(taskId)
        for (const succ of successors.get(taskId) ?? []) {
          const deg = (inDegree.get(succ) ?? 0) - 1
          inDegree.set(succ, deg)
          if (deg === 0) nextQueue.push(succ)
        }
      }
      queue = nextQueue
    }

    if (order.length !== tasks.length) {
      throw new PlannerError({
        message: 'Circular dependency detected in task graph',
        code: PlannerErrorCode.GraphBuildFailed,
        stage: 'building',
      })
    }

    return { order, layers }
  }

  /**
   * Computes the critical path using dynamic programming on the DAG.
   * Returns the longest chain of task IDs (by task count).
   */
  private computeCriticalPath(tasks: Task[], layers: string[][]): string[] {
    if (tasks.length === 0) return []

    // Build predecessor map
    const predecessors = new Map<string, string[]>()
    for (const task of tasks) {
      if (!predecessors.has(task.id)) predecessors.set(task.id, [])
      for (const depId of task.dependsOn) {
        const preds = predecessors.get(task.id)
        if (preds) preds.push(depId)
      }
    }

    // dp[taskId] = longest path from a root to this task
    const dp = new Map<string, number>()
    const prev = new Map<string, string | null>()

    // Process in topological order (layers are already sorted)
    for (const layer of layers) {
      for (const taskId of layer) {
        const preds = predecessors.get(taskId) ?? []
        if (preds.length === 0) {
          dp.set(taskId, 1)
          prev.set(taskId, null)
        } else {
          let best = 0
          let bestPred: string | null = null
          for (const predId of preds) {
            const predLen = dp.get(predId) ?? 0
            if (predLen > best) {
              best = predLen
              bestPred = predId
            }
          }
          dp.set(taskId, best + 1)
          prev.set(taskId, bestPred)
        }
      }
    }

    // Find the task with the maximum dp value (end of critical path)
    let maxLen = 0
    let endTask = tasks[0]?.id ?? ''
    for (const [taskId, len] of dp.entries()) {
      if (len > maxLen) {
        maxLen = len
        endTask = taskId
      }
    }

    // Trace back
    const path: string[] = []
    let current: string | null = endTask
    while (current !== null) {
      path.unshift(current)
      current = prev.get(current) ?? null
    }
    return path
  }
}
