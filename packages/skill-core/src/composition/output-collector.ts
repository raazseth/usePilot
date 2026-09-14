/**
 * OutputCollector — Runtime output propagation scratchpad for ComposedWorkflowOrchestrator.
 *
 * Lives for the duration of one orchestration run.
 * Records per-step outputs from ExecutionResult and resolves input bindings
 * for subsequent steps.
 *
 * Binding resolution priority:
 * 1. $steps.<stepId>.<key>  — recorded runtime output from a prior step
 * 2. $initial.<key>         — initial workflow input (shorthand)
 * 3. { source: 'workflow_input', key } — existing SkillComposer structured form
 * 4. { source: <stepId>, key }         — structured form referring to a prior step
 * 5. Static literal values             — pass-through unchanged
 */
export class OutputCollector {
  private readonly stepOutputs = new Map<string, Record<string, unknown>>()

  /**
   * Records actual runtime outputs for a completed step.
   * Called immediately after ExecutionRunner.run() returns.
   */
  record(stepId: string, outputs: Record<string, unknown>): void {
    this.stepOutputs.set(stepId, outputs)
  }

  /**
   * Resolves a single input binding for a step.
   *
   * @param binding  - The binding specification (string reference or structured object or literal)
   * @param initialInputs - The top-level workflow inputs provided by the caller
   * @returns The resolved value, or undefined if the reference cannot be resolved
   */
  resolve(
    binding: string | unknown,
    initialInputs: Record<string, unknown>
  ): unknown {
    if (typeof binding === 'string') {
      return this.resolveStringBinding(binding, initialInputs)
    }

    if (binding !== null && typeof binding === 'object' && 'source' in binding && 'key' in binding) {
      const b = binding as { source: string; key: string }
      if (b.source === 'workflow_input') {
        return initialInputs[b.key]
      }
      // Treat source as a stepId
      const stepOut = this.stepOutputs.get(b.source)
      if (stepOut !== undefined && stepOut[b.key] !== undefined) {
        return stepOut[b.key]
      }
      // Fallback to initial inputs
      return initialInputs[b.key]
    }

    // Static literal value — return as-is
    return binding
  }

  /**
   * Resolves all bindings for a step's inputBindings map.
   *
   * @param inputBindings - The step's inputBindings map
   * @param initialInputs - The top-level workflow inputs
   * @returns A flat record of resolved input values (unresolved references become undefined)
   */
  resolveAll(
    inputBindings: Record<string, string | unknown>,
    initialInputs: Record<string, unknown>
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    for (const [key, binding] of Object.entries(inputBindings)) {
      resolved[key] = this.resolve(binding, initialInputs)
    }
    return resolved
  }

  /**
   * Returns all recorded outputs keyed by stepId.
   * Useful for debugging and receipt generation.
   */
  getAll(): Record<string, Record<string, unknown>> {
    const result: Record<string, Record<string, unknown>> = {}
    for (const [stepId, outputs] of this.stepOutputs) {
      result[stepId] = outputs
    }
    return result
  }

  /**
   * Returns outputs recorded for a specific step, or empty object if none recorded.
   */
  getStepOutputs(stepId: string): Record<string, unknown> {
    return this.stepOutputs.get(stepId) ?? {}
  }

  private resolveStringBinding(
    binding: string,
    initialInputs: Record<string, unknown>
  ): unknown {
    // $steps.<stepId>.<key>  — runtime output from a prior step
    if (binding.startsWith('$steps.')) {
      const remainder = binding.slice('$steps.'.length)
      const dotIdx = remainder.indexOf('.')
      if (dotIdx === -1) return undefined

      const stepId = remainder.slice(0, dotIdx)
      const key = remainder.slice(dotIdx + 1)
      const stepOut = this.stepOutputs.get(stepId)
      return stepOut?.[key]
    }

    // $initial.<key>  — shorthand for initial workflow input
    if (binding.startsWith('$initial.')) {
      const key = binding.slice('$initial.'.length)
      return initialInputs[key]
    }

    // $<key>  — legacy shorthand used by the original SkillComposer
    if (binding.startsWith('$')) {
      const path = binding.slice(1) // e.g. "step1.reportContent" or "initial.url"
      const dotIdx = path.indexOf('.')
      if (dotIdx !== -1) {
        const prefix = path.slice(0, dotIdx)
        const key = path.slice(dotIdx + 1)
        const stepOut = this.stepOutputs.get(prefix)
        if (stepOut !== undefined) return stepOut[key]
        // fallback to initialInputs at that path
        return initialInputs[key] ?? initialInputs[path]
      }
      return initialInputs[path]
    }

    // Not a reference — return as static string literal
    return binding
  }
}
