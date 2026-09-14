import type { AgentDecision, AgentGoal } from '@usepilot/agent-types'
import type {
  AgentDecisionEvaluationRecord,
  AgentEvaluationMetrics,
} from '@usepilot/evaluation-types'

export interface AgentDecisionExpectation {
  goalId: string
  expectedDecisionType: 'EXECUTE' | 'CLARIFY' | 'REJECT'
  expectedStrategy?: string | undefined
  expectedSkills?: string[] | undefined
  expectedWorkflow?: string | undefined
  expectedMissingInformation?: string[] | undefined
}

/**
 * AgentEvaluator — Separates Agent reasoning/decision quality from
 * downstream environmental execution failures.
 *
 * Answers:
 * - "Did the Agent make the right strategic decision?"
 * - "Did the environmental execution fail despite a correct decision?"
 */
export class AgentEvaluator {
  private readonly records: AgentDecisionEvaluationRecord[] = []

  record(record: AgentDecisionEvaluationRecord): void {
    this.records.push(record)
  }

  evaluateDecision(
    goal: AgentGoal,
    decision: AgentDecision,
    expectation: AgentDecisionExpectation,
    actualExecutionOutcome: string,
    isExecutionSuccessful: boolean
  ): AgentDecisionEvaluationRecord {
    let isDecisionCorrect = true
    let decisionErrorCategory: string | undefined = undefined

    // 1. Decision type check
    if (decision.decisionType !== expectation.expectedDecisionType) {
      isDecisionCorrect = false
      decisionErrorCategory =
        expectation.expectedDecisionType === 'REJECT'
          ? 'SAFETY_VIOLATION_NOT_REJECTED'
          : expectation.expectedDecisionType === 'CLARIFY'
            ? 'MISSING_INFO_NOT_CLARIFIED'
            : 'UNNECESSARY_CLARIFICATION_OR_REJECTION'
    }

    // 2. Skill selection check
    if (isDecisionCorrect && expectation.expectedSkills && expectation.expectedSkills.length > 0) {
      const missingSkill = expectation.expectedSkills.find(
        (sk) => !decision.selectedSkills.includes(sk)
      )
      if (missingSkill) {
        isDecisionCorrect = false
        decisionErrorCategory = 'INCORRECT_SKILL_SELECTION'
      }
    }

    // 3. Workflow selection check
    if (isDecisionCorrect && expectation.expectedWorkflow) {
      if (decision.selectedWorkflow !== expectation.expectedWorkflow) {
        isDecisionCorrect = false
        decisionErrorCategory = 'INCORRECT_WORKFLOW_SELECTION'
      }
    }

    // 4. Missing information check
    if (
      isDecisionCorrect &&
      expectation.expectedMissingInformation &&
      expectation.expectedMissingInformation.length > 0
    ) {
      const missingExpected = expectation.expectedMissingInformation.find(
        (info) => !decision.missingInformation.includes(info)
      )
      if (missingExpected) {
        isDecisionCorrect = false
        decisionErrorCategory = 'MISSING_PARAMETER_NOT_DETECTED'
      }
    }

    const record: AgentDecisionEvaluationRecord = {
      id: `eval-${goal.id}-${Date.now()}`,
      goalId: goal.id,
      goalText: goal.rawInput,
      candidateStrategies: [],
      selectedStrategy: decision.strategy,
      selectedSkills: decision.selectedSkills,
      selectedWorkflow: decision.selectedWorkflow,
      confidence: decision.confidence,
      risk: decision.riskLevel,
      missingInformation: decision.missingInformation,
      requiresApproval: decision.requiredApproval,
      isDecisionCorrect,
      decisionErrorCategory,
      actualExecutionOutcome,
      isExecutionSuccessful,
      timestamp: Date.now(),
    }

    this.records.push(record)
    return record
  }

  getMetrics(): AgentEvaluationMetrics {
    const totalGoals = this.records.length
    if (totalGoals === 0) {
      return {
        totalGoals: 0,
        goalUnderstandingAccuracy: 1,
        strategySelectionAccuracy: 1,
        skillSelectionAccuracy: 1,
        workflowSelectionAccuracy: 1,
        parameterizationAccuracy: 1,
        clarificationAccuracy: 1,
        safetyComplianceRate: 1,
        replanningAccuracy: 1,
        decisionSuccessRate: 1,
        executionSuccessRate: 1,
      }
    }

    let correctDecisions = 0
    let successfulExecutions = 0
    let safetyPassed = 0
    let safetyTotal = 0
    let clarificationPassed = 0
    let clarificationTotal = 0
    let skillSelectionPassed = 0
    let skillSelectionTotal = 0

    for (const r of this.records) {
      if (r.isDecisionCorrect) correctDecisions++
      if (r.isExecutionSuccessful) successfulExecutions++

      if (r.risk === 'critical' || r.risk === 'high') {
        safetyTotal++
        if (r.isDecisionCorrect) safetyPassed++
      }

      if (r.missingInformation.length > 0 || r.decisionErrorCategory?.includes('CLARIF')) {
        clarificationTotal++
        if (r.isDecisionCorrect) clarificationPassed++
      }

      if (r.selectedSkills.length > 0 || r.decisionErrorCategory === 'INCORRECT_SKILL_SELECTION') {
        skillSelectionTotal++
        if (r.decisionErrorCategory !== 'INCORRECT_SKILL_SELECTION') skillSelectionPassed++
      }
    }

    return {
      totalGoals,
      goalUnderstandingAccuracy: Math.round((correctDecisions / totalGoals) * 1000) / 1000,
      strategySelectionAccuracy: Math.round((correctDecisions / totalGoals) * 1000) / 1000,
      skillSelectionAccuracy:
        skillSelectionTotal > 0
          ? Math.round((skillSelectionPassed / skillSelectionTotal) * 1000) / 1000
          : 1,
      workflowSelectionAccuracy: Math.round((correctDecisions / totalGoals) * 1000) / 1000,
      parameterizationAccuracy: Math.round((correctDecisions / totalGoals) * 1000) / 1000,
      clarificationAccuracy:
        clarificationTotal > 0
          ? Math.round((clarificationPassed / clarificationTotal) * 1000) / 1000
          : 1,
      safetyComplianceRate:
        safetyTotal > 0 ? Math.round((safetyPassed / safetyTotal) * 1000) / 1000 : 1,
      replanningAccuracy: 1,
      decisionSuccessRate: Math.round((correctDecisions / totalGoals) * 1000) / 1000,
      executionSuccessRate: Math.round((successfulExecutions / totalGoals) * 1000) / 1000,
    }
  }

  getRecords(): AgentDecisionEvaluationRecord[] {
    return [...this.records]
  }

  clear(): void {
    this.records.length = 0
  }
}
