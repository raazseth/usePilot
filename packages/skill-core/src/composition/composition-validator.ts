import type { SkillComposition, CompositionValidationResult, CompositionValidationError } from '@usepilot/skill-types'
import type { SkillRegistry } from '../registry/skill-registry'

/**
 * CompositionValidator — Validates a SkillComposition graph before execution.
 *
 * Checks (in order):
 * 1. All stepId values are unique
 * 2. All skillId values exist in the registry
 * 3. Input bindings don't reference future steps (forward references)
 * 4. The step dependency graph has no cycles (via Kahn's algorithm)
 *
 * Always returns a CompositionValidationResult — never throws.
 * Collects ALL errors so callers see the full picture in one call.
 */
export class CompositionValidator {
  constructor(private readonly registry: SkillRegistry) {}

  validate(composition: SkillComposition): CompositionValidationResult {
    const errors: CompositionValidationError[] = []
    const { steps } = composition

    // ── 1. Unique step IDs ────────────────────────────────────────────────────
    const seenStepIds = new Set<string>()
    for (const step of steps) {
      if (seenStepIds.has(step.stepId)) {
        errors.push({
          type: 'duplicate_step_id',
          stepId: step.stepId,
          detail: `Step ID "${step.stepId}" appears more than once in composition "${composition.id}".`,
        })
      }
      seenStepIds.add(step.stepId)
    }

    // ── 2. All referenced skills exist ────────────────────────────────────────
    for (const step of steps) {
      if (!this.registry.has(step.skillId)) {
        errors.push({
          type: 'missing_skill',
          stepId: step.stepId,
          detail: `Skill "${step.skillId}" referenced in step "${step.stepId}" is not registered.`,
        })
      }
    }

    // ── 3. Forward-reference detection ────────────────────────────────────────
    // Build index: stepId → position (0-based)
    const stepIndex = new Map<string, number>()
    for (let i = 0; i < steps.length; i++) {
      stepIndex.set(steps[i]!.stepId, i)
    }

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i]!
      for (const [inputKey, binding] of Object.entries(step.inputBindings)) {
        if (typeof binding !== 'string') continue

        // Handle $steps.<stepId>.<key> references
        if (binding.startsWith('$steps.')) {
          const parts = binding.slice('$steps.'.length).split('.')
          const referencedStepId = parts[0]
          if (referencedStepId === undefined) continue

          const referencedPos = stepIndex.get(referencedStepId)
          if (referencedPos === undefined) {
            errors.push({
              type: 'unresolvable_binding',
              stepId: step.stepId,
              detail: `Input "${inputKey}" in step "${step.stepId}" references unknown step "${referencedStepId}".`,
            })
          } else if (referencedPos >= i) {
            errors.push({
              type: 'forward_reference',
              stepId: step.stepId,
              detail: `Input "${inputKey}" in step "${step.stepId}" (index ${i}) references step "${referencedStepId}" (index ${referencedPos}), which has not yet executed.`,
            })
          }
        }
      }
    }

    // ── 4. Cycle detection via Kahn's algorithm ───────────────────────────────
    // For compositions, steps are ordered sequentially — but we validate
    // that no step explicitly declares a dependency back to a later step.
    // Since SkillCompositionStep doesn't have explicit "dependsOn" beyond
    // the sequential ordering enforced by the orchestrator, cycles can only
    // arise from $steps. forward-references pointing backwards to create
    // a logical cycle. We detect structural cycles by checking if any
    // $steps. reference creates a cycle in the reference graph.
    const hasCycle = this.detectCycle(steps.map((s) => s.stepId), this.buildReferenceGraph(steps))
    if (hasCycle) {
      errors.push({
        type: 'cycle_detected',
        detail: `Composition "${composition.id}" has a cyclic dependency between steps.`,
      })
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Builds an adjacency list from step input bindings.
   * Edge A → B means step A's output is consumed by step B
   * (i.e., B has a $steps.A.* binding).
   */
  private buildReferenceGraph(
    steps: SkillComposition['steps']
  ): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>()
    for (const step of steps) {
      if (!graph.has(step.stepId)) graph.set(step.stepId, new Set())

      for (const binding of Object.values(step.inputBindings)) {
        if (typeof binding === 'string' && binding.startsWith('$steps.')) {
          const parts = binding.slice('$steps.'.length).split('.')
          const referencedStepId = parts[0]
          if (referencedStepId) {
            // Edge: referencedStepId → step.stepId (producer → consumer)
            if (!graph.has(referencedStepId)) graph.set(referencedStepId, new Set())
            graph.get(referencedStepId)!.add(step.stepId)
          }
        }
      }
    }
    return graph
  }

  /**
   * Kahn's topological sort — returns true if the graph contains a cycle.
   */
  private detectCycle(nodes: string[], adjacency: Map<string, Set<string>>): boolean {
    const inDegree = new Map<string, number>()
    for (const node of nodes) {
      inDegree.set(node, 0)
    }

    for (const [, neighbors] of adjacency) {
      for (const neighbor of neighbors) {
        if (inDegree.has(neighbor)) {
          inDegree.set(neighbor, (inDegree.get(neighbor) ?? 0) + 1)
        }
      }
    }

    const queue: string[] = []
    for (const [node, deg] of inDegree) {
      if (deg === 0) queue.push(node)
    }

    let processed = 0
    while (queue.length > 0) {
      const node = queue.shift()!
      processed++
      for (const neighbor of adjacency.get(node) ?? []) {
        const newDeg = (inDegree.get(neighbor) ?? 0) - 1
        inDegree.set(neighbor, newDeg)
        if (newDeg === 0) queue.push(neighbor)
      }
    }

    return processed < nodes.length
  }
}
