// PlanOptimizer

import type { Task, TaskGraph, OptimizationResult } from '@usepilot/planner-types'
import { GraphBuilder } from '../graph/builder'

export interface OptimizeOutput {
  tasks: Task[]
  graph: TaskGraph
  optimization: OptimizationResult
}

export class PlanOptimizer {
  private readonly graphBuilder = new GraphBuilder()

  optimize(tasks: Task[], graph: TaskGraph): OptimizeOutput {
    let working = [...tasks]
    const mergedTasks: Array<{ from: string[]; into: string }> = []
    const removedDuplicates: string[] = []
    const simplifications: string[] = []

    // 1. Remove exact duplicates (same title + same capability/tool)
    const seen = new Map<string, string>() // key → first task ID
    const deduped: Task[] = []
    for (const task of working) {
      const key = `${task.title.toLowerCase()}|${task.requiredCapability || task.requiredTool}`
      const existing = seen.get(key)
      if (existing) {
        removedDuplicates.push(task.id)
        simplifications.push(`Removed duplicate task: "${task.title}"`)
        // Update downstream dependsOn references to point to the first occurrence
        deduped.forEach((t) => {
          t.dependsOn = t.dependsOn.map((dep) => (dep === task.id ? existing : dep))
        })
      } else {
        seen.set(key, task.id)
        deduped.push(task)
      }
    }
    working = deduped

    // 2. Merge consecutive tasks with the same capability/tool and no shared successors
    const merged: Task[] = []
    let i = 0
    while (i < working.length) {
      const curr = working[i]
      const next = working[i + 1]
      const sameCapability =
        curr?.requiredCapability &&
        next?.requiredCapability &&
        curr.requiredCapability === next.requiredCapability &&
        curr.requiredCapability !== 'none'
      const sameTool = curr?.requiredTool === next?.requiredTool && curr?.requiredTool !== 'none'

      if (
        curr &&
        next &&
        (sameCapability || sameTool) &&
        next.dependsOn.length === 1 &&
        next.dependsOn[0] === curr.id &&
        curr.approvalPolicy === 'automatic' &&
        next.approvalPolicy === 'automatic'
      ) {
        // Merge next into curr
        const mergedTask: Task = {
          ...curr,
          title: curr.title,
          description: `${curr.description}\nThen: ${next.description}`,
          successConditions: [...curr.successConditions, ...next.successConditions],
          postconditions: next.postconditions,
          requiredCapability: curr.requiredCapability,
        }
        mergedTasks.push({ from: [curr.id, next.id], into: mergedTask.id })
        simplifications.push(`Merged tasks: "${curr.title}" + "${next.title}"`)
        // Update references to next.id → curr.id
        const updateId = next.id
        working.forEach((t) => {
          t.dependsOn = t.dependsOn.map((dep) => (dep === updateId ? curr.id : dep))
        })
        merged.push(mergedTask)
        i += 2
      } else {
        if (curr) merged.push(curr)
        i++
      }
    }
    working = merged

    // 3. Rebuild graph after mutations
    let finalGraph: TaskGraph
    try {
      finalGraph = this.graphBuilder.build(working)
    } catch {
      // If graph rebuild fails, return original graph unchanged
      finalGraph = graph
      simplifications.push('Warning: graph rebuild failed after optimization — using original graph')
    }

    // 4. Detect newly parallelizable groups (already handled by GraphBuilder, just report)
    const newParallelGroups = finalGraph.parallelGroups.filter(
      (g) => !graph.parallelGroups.some((og) => og.join(',') === g.join(','))
    )
    if (newParallelGroups.length > 0) {
      simplifications.push(`Discovered ${newParallelGroups.length} new parallel execution group(s)`)
    }

    const changed =
      mergedTasks.length > 0 || removedDuplicates.length > 0 || newParallelGroups.length > 0

    return {
      tasks: working,
      graph: finalGraph,
      optimization: {
        mergedTasks,
        removedDuplicates,
        newParallelGroups,
        simplifications,
        changed,
      },
    }
  }
}
