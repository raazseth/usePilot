import type { SkillComposition } from '@usepilot/skill-types'

export interface RecoveryLimits {
  maxReplans: number
  maxRetries: number
  maxSteps: number
  maxIterations: number
}

export const DEFAULT_RECOVERY_LIMITS: RecoveryLimits = {
  maxReplans: 2,
  maxRetries: 3,
  maxSteps: 10,
  maxIterations: 5,
}

export interface RecoveryEvaluation {
  action: 'REPLAN' | 'RETRY' | 'CLARIFY' | 'ABORT'
  canRecover: boolean
  replanCount: number
  iterationCount: number
  reason: string
  revisedComposition?: SkillComposition | undefined
}

/**
 * AgentRecoveryController — Governs bounded recovery and replanning.
 *
 * Invariants:
 * 1. Hard limits (maxReplans=2, maxIterations=5) prevent unbounded loops.
 * 2. Unrecoverable failures (safety aborts, permission denials) fail closed immediately.
 * 3. Never silently loop without explaining failure to user.
 */
export class AgentRecoveryController {
  private replanCount = 0
  private iterationCount = 0
  private readonly limits: RecoveryLimits

  constructor(limits: Partial<RecoveryLimits> = {}) {
    this.limits = { ...DEFAULT_RECOVERY_LIMITS, ...limits }
  }

  getReplans(): number {
    return this.replanCount
  }

  getIterations(): number {
    return this.iterationCount
  }

  recordIteration(): void {
    this.iterationCount++
  }

  evaluateFailure(
    error: string,
    failedStepId?: string,
    currentComposition?: SkillComposition
  ): RecoveryEvaluation {
    this.iterationCount++

    // 1. Unrecoverable security / permission errors
    if (/\b(?:permission denied|unauthorized|destructive|safety violation)\b/i.test(error)) {
      return {
        action: 'ABORT',
        canRecover: false,
        replanCount: this.replanCount,
        iterationCount: this.iterationCount,
        reason: `Execution aborted due to security or permission failure: ${error}`,
      }
    }

    // 2. Loop boundary checks
    if (this.iterationCount >= this.limits.maxIterations) {
      return {
        action: 'ABORT',
        canRecover: false,
        replanCount: this.replanCount,
        iterationCount: this.iterationCount,
        reason: `Exceeded maximum agent iteration limit (${this.limits.maxIterations}). Stopping to prevent unbounded execution loop.`,
      }
    }

    if (this.replanCount >= this.limits.maxReplans) {
      return {
        action: 'ABORT',
        canRecover: false,
        replanCount: this.replanCount,
        iterationCount: this.iterationCount,
        reason: `Exceeded maximum replan limit (${this.limits.maxReplans}). Execution failed permanently: ${error}`,
      }
    }

    // 3. Recoverable failure: Target missing or network timeout in multi-step flow
    // If a step failed because of stale destination or transient failure, formulate revised composition
    if (currentComposition && failedStepId) {
      this.replanCount++

      // Create a revised composition omitting failed non-essential predecessor or swapping to fallback
      const remainingSteps = currentComposition.steps.filter((s) => s.stepId !== failedStepId)
      if (remainingSteps.length > 0) {
        const revised: SkillComposition = {
          ...currentComposition,
          id: `${currentComposition.id}-replan-${this.replanCount}`,
          name: `${currentComposition.name} (Recovery Replan ${this.replanCount})`,
          steps: remainingSteps,
        }

        return {
          action: 'REPLAN',
          canRecover: true,
          replanCount: this.replanCount,
          iterationCount: this.iterationCount,
          reason: `Step "${failedStepId}" failed (${error}). Formulated recovery plan with remaining ${remainingSteps.length} step(s).`,
          revisedComposition: revised,
        }
      }
    }

    // 4. Default: Abort safely
    return {
      action: 'ABORT',
      canRecover: false,
      replanCount: this.replanCount,
      iterationCount: this.iterationCount,
      reason: `Unrecoverable execution failure: ${error}`,
    }
  }

  reset(): void {
    this.replanCount = 0
    this.iterationCount = 0
  }
}
