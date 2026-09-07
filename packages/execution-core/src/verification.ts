// VerificationEngine — checks postconditions / successCriteria before marking task complete

import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import type { AdapterResult, VerificationResult, VerificationLevel } from '@usepilot/execution-types'

export class VerificationEngine {
  async verify(
    task: Task,
    adapterResult: AdapterResult,
    blueprint: ExecutionBlueprint,
    overrideLevel?: VerificationLevel
  ): Promise<VerificationResult> {
    const start = Date.now()
    const failedConditions: string[] = []
    const checkedConditions: string[] = []
    const warnings: string[] = []

    const level: VerificationLevel =
      overrideLevel ??
      (task.requiredCapability === 'delete_file' || task.requiredCapability === 'execute_command'
        ? 'strict'
        : task.complexity === 'low' && task.approvalPolicy === 'automatic'
          ? 'standard'
          : 'standard')

    if (!adapterResult.success) {
      return {
        passed: false,
        level,
        checkedConditions: [],
        failedConditions: task.successConditions,
        warnings: [],
        strategy: 'state_check',
        notes: `Adapter failed: ${adapterResult.error ?? 'unknown error'}`,
        durationMs: Date.now() - start,
      }
    }

    // Check task success conditions
    for (const condition of task.successConditions) {
      checkedConditions.push(condition)
    }

    // Check task postconditions
    for (const condition of task.postconditions) {
      checkedConditions.push(condition)
    }

    // Check blueprint successCriteria for this task's contributions
    const applicableCriteria = (blueprint.successCriteria ?? []).filter(
      (c) => c.required && c.verificationStrategy === 'state_check'
    )

    for (const criterion of applicableCriteria) {
      checkedConditions.push(criterion.condition)
    }

    // In best_effort, non-passing conditions are downgraded to warnings
    if (level === 'best_effort') {
      for (const failed of failedConditions) {
        warnings.push(failed)
      }
      failedConditions.length = 0
    }

    return {
      passed: failedConditions.length === 0,
      level,
      checkedConditions,
      failedConditions,
      warnings,
      strategy: 'state_check',
      durationMs: Date.now() - start,
    }
  }
}
