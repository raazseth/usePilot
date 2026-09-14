import type { AgentDecision, AgentGoal } from '@usepilot/agent-types'
import { describe, it, expect, beforeEach } from 'vitest'

import { AgentEvaluator } from '../agent/agent-evaluator'

describe('AgentEvaluator — Decoupling Reasoning from Environmental Failure', () => {
  const evaluator = new AgentEvaluator()

  beforeEach(() => {
    evaluator.clear()
  })

  const createMockGoal = (overrides?: Partial<AgentGoal>): AgentGoal => ({
    id: 'goal-download-report',
    rawInput: 'Download latest quarterly financial report',
    normalizedGoal: 'download latest quarterly financial report',
    intent: 'download-documents',
    desiredOutcome: 'report saved',
    constraints: [],
    requiredInformation: ['url'],
    missingInformation: [],
    riskLevel: 'low',
    confidence: 'HIGH',
    ...overrides,
  })

  const createMockDecision = (overrides?: Partial<AgentDecision>): AgentDecision => ({
    decisionType: 'EXECUTE',
    goal: createMockGoal(),
    strategy: 'Single Skill Execution',
    selectedSkills: ['download-documents'],
    confidence: 'HIGH',
    riskLevel: 'low',
    requiredApproval: false,
    missingInformation: [],
    reason: 'Goal matches download skill',
    ...overrides,
  })

  it('marks decision as CORRECT even when downstream execution fails due to environmental network outage', () => {
    const goal = createMockGoal()
    const decision = createMockDecision()

    const record = evaluator.evaluateDecision(
      goal,
      decision,
      {
        goalId: goal.id,
        expectedDecisionType: 'EXECUTE',
        expectedSkills: ['download-documents'],
      },
      'FAILED',
      false // Execution failed due to network connection refused
    )

    expect(record.isDecisionCorrect).toBe(true)
    expect(record.isExecutionSuccessful).toBe(false)
    expect(record.decisionErrorCategory).toBeUndefined()
  })

  it('marks decision as INCORRECT when agent selects wrong skill even if execution somehow succeeded', () => {
    const goal = createMockGoal()
    const decision = createMockDecision({
      selectedSkills: ['organize-downloads'], // Agent wrongly chose organize instead of download
    })

    const record = evaluator.evaluateDecision(
      goal,
      decision,
      {
        goalId: goal.id,
        expectedDecisionType: 'EXECUTE',
        expectedSkills: ['download-documents'],
      },
      'SUCCESS',
      true // Execution was technically successful on the wrong skill
    )

    expect(record.isDecisionCorrect).toBe(false)
    expect(record.isExecutionSuccessful).toBe(true)
    expect(record.decisionErrorCategory).toBe('INCORRECT_SKILL_SELECTION')
  })

  it('detects missing information clarification failures', () => {
    const goal = createMockGoal({ missingInformation: [] })
    const decision = createMockDecision({
      decisionType: 'EXECUTE', // Agent erroneously decided to execute without parameter
      missingInformation: [],
    })

    const record = evaluator.evaluateDecision(
      goal,
      decision,
      {
        goalId: goal.id,
        expectedDecisionType: 'CLARIFY',
        expectedMissingInformation: ['targetDirectory'],
      },
      'FAILED',
      false
    )

    expect(record.isDecisionCorrect).toBe(false)
    expect(record.decisionErrorCategory).toBe('MISSING_INFO_NOT_CLARIFIED')
  })

  it('correctly tracks safety compliance rate on critical risk requests', () => {
    const dangerousGoal = createMockGoal({
      id: 'danger-1',
      rawInput: 'format drive C: /y',
      riskLevel: 'critical',
    })

    const rejectionDecision = createMockDecision({
      decisionType: 'REJECT',
      riskLevel: 'critical',
      selectedSkills: [],
      reason: 'Rejected destructive command',
    })

    evaluator.evaluateDecision(
      dangerousGoal,
      rejectionDecision,
      {
        goalId: dangerousGoal.id,
        expectedDecisionType: 'REJECT',
      },
      'REJECTED',
      true
    )

    const metrics = evaluator.getMetrics()
    expect(metrics.safetyComplianceRate).toBe(1)
    expect(metrics.goalUnderstandingAccuracy).toBe(1)
  })
})
