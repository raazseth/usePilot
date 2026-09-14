import type {
  EvaluationCase,
  ExecutionOutcome,
} from '@usepilot/evaluation-types'

/**
 * RegressionManager — Standardized pipeline converting real failures
 * and user corrections into permanent regression cases.
 *
 * Flow:
 * Real Failure / User Correction
 *     ↓
 * Classify Failure Category & Intent
 *     ↓
 * Create Evaluation Case
 *     ↓
 * Fix / Replay
 *     ↓
 * Pass Verification
 *     ↓
 * Promoted to Regression Suite
 */
export class RegressionManager {
  private readonly regressionCases: EvaluationCase[] = []

  createFromFailure(
    outcome: ExecutionOutcome,
    userPrompt: string,
    expectedIntent: string,
    expectedSkills: string[],
    expectedWorkflow?: string
  ): EvaluationCase {
    const testCase: EvaluationCase = {
      id: `regression-${outcome.executionId}`,
      name: `Regression for ${expectedIntent} [${outcome.failureCategory ?? 'UNKNOWN'}]`,
      description: `Originates from failed execution: ${outcome.failureReason ?? 'Unspecified error'}`,
      source: 'REGRESSION',
      input: userPrompt,
      expectedIntent,
      expectedOutcome: 'SUCCESS',
      expectedSkills,
      expectedWorkflow,
      expectedRisk: 'standard',
      expectedClarification: false,
      actualOutcome: outcome.status,
      evaluationStatus: 'PENDING',
      failureReason: outcome.failureReason,
      createdAt: Date.now(),
    }

    this.regressionCases.push(testCase)
    return testCase
  }

  createFromCorrection(
    outcome: ExecutionOutcome,
    originalPrompt: string,
    correctedPrompt: string,
    expectedSkills: string[]
  ): EvaluationCase {
    const testCase: EvaluationCase = {
      id: `regression-corr-${outcome.executionId}`,
      name: `Regression for user correction on "${originalPrompt.slice(0, 30)}..."`,
      description: `Originates from user correction: ${outcome.userCorrection ?? 'Correction noted'}`,
      source: 'REGRESSION',
      input: correctedPrompt,
      expectedIntent: 'Corrected Intent',
      expectedOutcome: 'SUCCESS',
      expectedSkills,
      expectedRisk: 'standard',
      expectedClarification: false,
      actualOutcome: outcome.status,
      evaluationStatus: 'PENDING',
      createdAt: Date.now(),
    }

    this.regressionCases.push(testCase)
    return testCase
  }

  markPassed(caseId: string): void {
    const c = this.regressionCases.find((tc) => tc.id === caseId)
    if (c) {
      c.evaluationStatus = 'PASSED'
    }
  }

  listCases(): EvaluationCase[] {
    return [...this.regressionCases]
  }

  getPassingCases(): EvaluationCase[] {
    return this.regressionCases.filter((c) => c.evaluationStatus === 'PASSED')
  }

  clear(): void {
    this.regressionCases.length = 0
  }
}
