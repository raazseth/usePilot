// ExecutionValidator — Layer 3

import type {
  ExecutionBlueprint,
  LayerValidationResult,
  ValidationIssue,
  PlannerContext,
} from '@usepilot/planner-types'

export class ExecutionValidator {
  validate(blueprint: ExecutionBlueprint, context: PlannerContext): LayerValidationResult {
    const start = Date.now()
    const issues: ValidationIssue[] = []

    // 1. Forbidden task detection
    for (const task of blueprint.tasks) {
      if (task.approvalPolicy === 'forbidden') {
        issues.push({
          layer: 'execution',
          severity: 'error',
          code: 'FORBIDDEN_TASK',
          message: `Task "${task.title}" is marked forbidden. Reason: ${task.approvalReason ?? 'not specified'}`,
          target: task.id,
        })
      }
    }

    // 2. Circular dependency detection (DFS with white/grey/black coloring)
    const cycles = this.detectCycles(blueprint.tasks)
    for (const cycle of cycles) {
      issues.push({
        layer: 'execution',
        severity: 'error',
        code: 'CIRCULAR_DEPENDENCY',
        message: `Circular dependency detected: ${cycle.join(' → ')}`,
      })
    }

    // 3. Capability / Tool availability check
    const availableToolsSet = new Set(context.availableTools)
    const availableCapabilitiesSet = context.availableCapabilities?.length
      ? new Set(context.availableCapabilities)
      : undefined

    for (const task of blueprint.tasks) {
      if (
        availableCapabilitiesSet &&
        task.requiredCapability &&
        task.requiredCapability !== 'none' &&
        !availableCapabilitiesSet.has(task.requiredCapability)
      ) {
        issues.push({
          layer: 'execution',
          severity: 'warning',
          code: 'CAPABILITY_UNAVAILABLE',
          message: `Task "${task.title}" requires capability "${task.requiredCapability}" which is not registered as available in the current context`,
          target: task.id,
        })
      }

      if (task.requiredTool && task.requiredTool !== 'none' && !availableToolsSet.has(task.requiredTool)) {
        issues.push({
          layer: 'execution',
          severity: 'warning',
          code: 'TOOL_UNAVAILABLE',
          message: `Task "${task.title}" requires tool "${task.requiredTool}" which is not registered as available`,
          target: task.id,
        })
      }
    }

    // 4. Unreachable node detection (nodes that can never start because a predecessor is forbidden)
    const forbiddenIds = new Set(
      blueprint.tasks.filter((t) => t.approvalPolicy === 'forbidden').map((t) => t.id)
    )
    for (const task of blueprint.tasks) {
      if (task.dependsOn.some((dep) => forbiddenIds.has(dep))) {
        issues.push({
          layer: 'execution',
          severity: 'error',
          code: 'UNREACHABLE_TASK',
          message: `Task "${task.title}" depends on a forbidden task and can never execute`,
          target: task.id,
        })
      }
    }

    // 5. Self-dependency check
    for (const task of blueprint.tasks) {
      if (task.dependsOn.includes(task.id)) {
        issues.push({
          layer: 'execution',
          severity: 'error',
          code: 'SELF_DEPENDENCY',
          message: `Task "${task.title}" depends on itself`,
          target: task.id,
        })
      }
    }

    return {
      layer: 'execution',
      passed: !issues.some((i) => i.severity === 'error'),
      issues,
      durationMs: Date.now() - start,
    }
  }

  /**
   * DFS-based cycle detection.
   * Returns an array of cycle descriptions (as arrays of task IDs).
   */
  private detectCycles(tasks: import('@usepilot/planner-types').Task[]): string[][] {
    const WHITE = 0, GREY = 1, BLACK = 2
    const color = new Map<string, number>()
    const parent = new Map<string, string | null>()
    const cycles: string[][] = []

    // Build adjacency list
    const adj = new Map<string, string[]>()
    for (const task of tasks) {
      adj.set(task.id, [...task.dependsOn])
      color.set(task.id, WHITE)
      parent.set(task.id, null)
    }

    const dfs = (nodeId: string): void => {
      color.set(nodeId, GREY)
      for (const neighbor of adj.get(nodeId) ?? []) {
        if (color.get(neighbor) === GREY) {
          // Found a cycle — trace back
          const cycle: string[] = [neighbor, nodeId]
          let cur: string | null = nodeId
          while (cur && parent.get(cur) !== neighbor && parent.get(cur) !== null) {
            cur = parent.get(cur) ?? null
            if (cur) cycle.unshift(cur)
          }
          cycle.unshift(neighbor)
          cycles.push(cycle)
        } else if (color.get(neighbor) === WHITE) {
          parent.set(neighbor, nodeId)
          dfs(neighbor)
        }
      }
      color.set(nodeId, BLACK)
    }

    for (const task of tasks) {
      if (color.get(task.id) === WHITE) {
        dfs(task.id)
      }
    }

    return cycles
  }
}
