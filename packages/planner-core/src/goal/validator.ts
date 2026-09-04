// ─────────────────────────────────────────────────────────────────────────────
// GoalValidator
// Post-extraction completeness check. Zod validates the LLM output shape;
// this validates the domain semantics.
// ─────────────────────────────────────────────────────────────────────────────

import type { Goal } from '@usepilot/planner-types'
import { PlannerError, PlannerErrorCode } from '../errors'

export interface GoalValidationResult {
  valid: boolean
  issues: string[]
}

export class GoalValidator {
  validate(goal: Goal): GoalValidationResult {
    const issues: string[] = []

    if (!goal.primaryObjective || goal.primaryObjective.trim().length < 10) {
      issues.push('primaryObjective is too short or empty (minimum 10 characters)')
    }

    if (!goal.expectedOutcome || goal.expectedOutcome.trim().length < 5) {
      issues.push('expectedOutcome is missing or too vague')
    }

    if (goal.confidence < 0.1) {
      issues.push(`confidence is critically low (${goal.confidence}) — goal may be ambiguous`)
    }

    // Check for obviously incomplete objectives
    const ambiguousMarkers = ['something', 'stuff', 'things', 'etc', '...']
    for (const marker of ambiguousMarkers) {
      if (goal.primaryObjective.toLowerCase().includes(marker)) {
        issues.push(`primaryObjective contains vague language: "${marker}"`)
      }
    }

    return {
      valid: issues.length === 0,
      issues,
    }
  }

  validateOrThrow(goal: Goal): void {
    const result = this.validate(goal)
    if (!result.valid) {
      throw new PlannerError({
        message: `Goal validation failed: ${result.issues.join('; ')}`,
        code: PlannerErrorCode.GoalValidationFailed,
        stage: 'validating_goal',
      })
    }
  }
}
