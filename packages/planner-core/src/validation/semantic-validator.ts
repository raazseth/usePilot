// ─────────────────────────────────────────────────────────────────────────────
// SemanticValidator — Layer 2
// Checks logical coherence of the plan. Only runs if SchemaValidator passes.
// - Goal coverage: do tasks collectively achieve the objective?
// - Duplicate task ID detection
// - Orphan task detection (tasks referenced in edges but not in task list)
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionBlueprint, LayerValidationResult, ValidationIssue } from '@usepilot/planner-types'

export class SemanticValidator {
  validate(blueprint: ExecutionBlueprint): LayerValidationResult {
    const start = Date.now()
    const issues: ValidationIssue[] = []

    const taskIds = new Set<string>()

    // 1. Duplicate task ID detection
    for (const task of blueprint.tasks) {
      if (taskIds.has(task.id)) {
        issues.push({
          layer: 'semantic',
          severity: 'error',
          code: 'DUPLICATE_TASK_ID',
          message: `Duplicate task ID: "${task.id}" (title: "${task.title}")`,
          target: task.id,
        })
      }
      taskIds.add(task.id)
    }

    // 2. Graph node count matches task count
    if (blueprint.graph.nodes.length !== blueprint.tasks.length) {
      issues.push({
        layer: 'semantic',
        severity: 'error',
        code: 'GRAPH_TASK_MISMATCH',
        message: `Graph has ${blueprint.graph.nodes.length} nodes but blueprint has ${blueprint.tasks.length} tasks`,
      })
    }

    // 3. All graph node taskIds must exist in the task list
    for (const node of blueprint.graph.nodes) {
      if (!taskIds.has(node.taskId)) {
        issues.push({
          layer: 'semantic',
          severity: 'error',
          code: 'ORPHAN_NODE',
          message: `Graph node references unknown task ID: "${node.taskId}"`,
          target: node.taskId,
        })
      }
    }

    // 4. All edge endpoints must exist
    for (const edge of blueprint.graph.edges) {
      if (!taskIds.has(edge.from)) {
        issues.push({
          layer: 'semantic',
          severity: 'error',
          code: 'ORPHAN_EDGE_ENDPOINT',
          message: `Edge "from" references unknown task ID: "${edge.from}"`,
          target: edge.from,
        })
      }
      if (!taskIds.has(edge.to)) {
        issues.push({
          layer: 'semantic',
          severity: 'error',
          code: 'ORPHAN_EDGE_ENDPOINT',
          message: `Edge "to" references unknown task ID: "${edge.to}"`,
          target: edge.to,
        })
      }
    }

    // 5. All dependsOn references must exist
    for (const task of blueprint.tasks) {
      for (const depId of task.dependsOn) {
        if (!taskIds.has(depId)) {
          issues.push({
            layer: 'semantic',
            severity: 'error',
            code: 'MISSING_DEPENDENCY',
            message: `Task "${task.title}" depends on unknown task ID: "${depId}"`,
            target: task.id,
          })
        }
      }
    }

    // 6. Goal coverage heuristic — at least one task per required resource
    const taskDescriptions = blueprint.tasks
      .map((t) => `${t.title} ${t.description}`.toLowerCase())
      .join(' ')
    for (const resource of blueprint.goal.requiredResources) {
      const keyword = resource.toLowerCase().split(/\s+/)[0] ?? ''
      if (keyword.length > 2 && !taskDescriptions.includes(keyword)) {
        issues.push({
          layer: 'semantic',
          severity: 'warning',
          code: 'UNCOVERED_RESOURCE',
          message: `Required resource "${resource}" may not be addressed by any task`,
          target: 'goal.requiredResources',
        })
      }
    }

    // 7. Tasks with no success conditions (should have been caught by schema, but belt-and-suspenders)
    for (const task of blueprint.tasks) {
      if (task.successConditions.length === 0) {
        issues.push({
          layer: 'semantic',
          severity: 'warning',
          code: 'MISSING_SUCCESS_CONDITIONS',
          message: `Task "${task.title}" has no success conditions`,
          target: task.id,
        })
      }
    }

    return {
      layer: 'semantic',
      passed: !issues.some((i) => i.severity === 'error'),
      issues,
      durationMs: Date.now() - start,
    }
  }
}
