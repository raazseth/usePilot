// TaskScheduler — consumes the blueprint dependency graph without rebuilding

import type { ExecutionBlueprint, Task } from '@usepilot/planner-types'

export interface TaskBatch {
  batchIndex: number
  tasks: Task[]
  canParallelize: boolean
  hasOptional: boolean
}

export class TaskScheduler {
  schedule(blueprint: ExecutionBlueprint): TaskBatch[] {
    const { graph, tasks } = blueprint
    const taskMap = new Map(tasks.map((t) => [t.id, t]))
    const batches: TaskBatch[] = []

    if (graph.parallelGroups && graph.parallelGroups.length > 0) {
      graph.parallelGroups.forEach((group, index) => {
        const groupTasks = group.map((id) => taskMap.get(id)).filter((t): t is Task => t != null)
        const hasMandatory = groupTasks.some((t) => t.approvalPolicy === 'mandatory')

        if (hasMandatory) {
          // Split mandatory tasks into their own serial batches
          for (const task of groupTasks) {
            batches.push({
              batchIndex: batches.length,
              tasks: [task],
              canParallelize: false,
              hasOptional: task.isOptional ?? false,
            })
          }
        } else {
          const canParallelize = groupTasks.length > 1
          batches.push({
            batchIndex: index,
            tasks: groupTasks,
            canParallelize,
            hasOptional: groupTasks.some((t) => t.isOptional),
          })
        }
      })
    } else {
      // Fall back to topological layer order from DAG nodes
      const layers = new Map<number, string[]>()
      for (const node of graph.nodes) {
        const layer = node.layer
        const existing = layers.get(layer) ?? []
        existing.push(node.taskId)
        layers.set(layer, existing)
      }

      const sortedLayers = Array.from(layers.entries()).sort(([a], [b]) => a - b)

      for (const [, taskIds] of sortedLayers) {
        const batchTasks = taskIds.map((id) => taskMap.get(id)).filter((t): t is Task => t != null)
        const hasMandatory = batchTasks.some((t) => t.approvalPolicy === 'mandatory')

        if (hasMandatory) {
          for (const task of batchTasks) {
            batches.push({
              batchIndex: batches.length,
              tasks: [task],
              canParallelize: false,
              hasOptional: task.isOptional ?? false,
            })
          }
        } else {
          batches.push({
            batchIndex: batches.length,
            tasks: batchTasks,
            canParallelize: batchTasks.length > 1,
            hasOptional: batchTasks.some((t) => t.isOptional),
          })
        }
      }
    }

    return batches
  }

  getExecutionOrder(blueprint: ExecutionBlueprint): string[] {
    const batches = this.schedule(blueprint)
    return batches.flatMap((b) => b.tasks.map((t) => t.id))
  }
}
