import {
  AgentStrategySelector,
} from '@usepilot/agent-core'
import {
  createDefaultSkillRegistry,
  createDefaultCompositionRegistry,
} from '@usepilot/skill-core'
import { describe, it, expect } from 'vitest'

import {
  OutcomeClassifier,
  SkillEvaluator,
  WorkflowEvaluator,
  ReliabilityEngine,
  PreferenceEngine,
  EvaluationDashboard,
  RegressionManager,
  AgentEvaluator,
} from '../index'

describe('Phase 9 Learning Loop E2E — Feedback into Subsequent Strategy Decisions', () => {
  it('executes full pipeline: Execution -> Verification -> Outcome -> Evaluation -> Reliability & Preference -> Optimized Subsequent Decision', () => {
    const skillRegistry = createDefaultSkillRegistry()
    const compositionRegistry = createDefaultCompositionRegistry()

    const outcomeClassifier = new OutcomeClassifier()
    const skillEvaluator = new SkillEvaluator()
    const workflowEvaluator = new WorkflowEvaluator()
    const reliabilityEngine = new ReliabilityEngine(skillEvaluator, workflowEvaluator)
    const preferenceEngine = new PreferenceEngine()
    const regressionManager = new RegressionManager()
    const agentEvaluator = new AgentEvaluator()

    const dashboard = new EvaluationDashboard(
      skillEvaluator,
      workflowEvaluator,
      agentEvaluator,
      preferenceEngine,
      regressionManager
    )

    // Step 1: Simulate 3 repeated successful executions with user's preferred reports folder
    for (let i = 1; i <= 3; i++) {
      const outcome = outcomeClassifier.classify({
        executionId: `exec-${i}`,
        goalId: `goal-${i}`,
        agentId: 'computer-operator-agent',
        agentVersion: '1.0.0',
        workflowId: 'research-download-and-organize',
        workflowVersion: '1.0.0',
        receipt: {
          compositionId: 'research-download-and-organize',
          compositionVersion: '1.0.0',
          status: 'completed',
          totalTasksExecuted: 3,
          durationMs: 450,
          stepReceipts: [
            { stepId: 's1', skillId: 'research-website', status: 'completed', verified: true, durationMs: 150, outputs: {} },
            { stepId: 's2', skillId: 'download-documents', status: 'completed', verified: true, durationMs: 150, outputs: {} },
            { stepId: 's3', skillId: 'organize-downloads', status: 'completed', verified: true, durationMs: 150, outputs: {} },
          ],
        },
      })

      expect(outcome.status).toBe('SUCCESS')
      expect(outcome.verificationStatus).toBe(true)

      // Feed into evaluators
      skillEvaluator.record(outcome)
      workflowEvaluator.record(outcome)

      // Observe user preference for defaultReportsFolder
      preferenceEngine.observe('defaultReportsFolder', 'C:/Users/Raaz/AppData/Local/Reports', `run-${i}`)
    }

    // Step 2: Verify preference is now VALIDATED
    const validatedPrefs = preferenceEngine.listValidatedPreferences()
    expect(validatedPrefs.length).toBe(1)
    expect(validatedPrefs[0]?.key).toBe('defaultReportsFolder')
    expect(validatedPrefs[0]?.value).toBe('C:/Users/Raaz/AppData/Local/Reports')
    expect(validatedPrefs[0]?.status).toBe('VALIDATED')
    expect(validatedPrefs[0]?.confidence).toBe('HIGH')

    // Step 3: Instantiate AgentStrategySelector configured with the live Reliability & Preference engines
    const selector = new AgentStrategySelector({
      skillRegistry,
      compositionRegistry,
      reliabilityProvider: reliabilityEngine,
      preferenceProvider: preferenceEngine,
    })

    // Step 4: User submits a subsequent goal with colloquial reference "into my reports folder"
    const subsequentGoal = {
      id: 'subsequent-goal-1',
      rawInput: 'Go to https://example.com/company, research their products, download PDF documents, and organize them into my reports folder',
      normalizedGoal: 'go to https://example.com/company, research their products, download pdf documents, and organize them into my reports folder',
      intent: 'research-download-and-organize',
      desiredOutcome: 'research reports organized',
      constraints: [],
      requiredInformation: [],
      missingInformation: [],
      riskLevel: 'low' as const,
      confidence: 'HIGH' as const,
    }

    const decision = selector.selectStrategy(subsequentGoal)

    // The selector should have resolved "my reports folder" to "C:/Users/Raaz/AppData/Local/Reports"
    // and matched the predefined composition research-download-and-organize
    expect(decision.decisionType).toBe('REUSE_WORKFLOW')
    expect(decision.selectedWorkflow).toBe('research-download-and-organize')
    expect(decision.missingInformation.length).toBe(0)

    // Step 5: Test operational dashboard generation
    const dashboardReport = dashboard.generateReport([
      outcomeClassifier.classify({
        executionId: 'exec-final',
        goalId: 'goal-final',
        agentId: 'computer-operator-agent',
        agentVersion: '1.0.0',
        receipt: {
          compositionId: 'download-and-organize',
          compositionVersion: '1.0.0',
          status: 'completed',
          totalTasksExecuted: 2,
          durationMs: 300,
          stepReceipts: [
            { stepId: 's1', skillId: 'download-documents', status: 'completed', verified: true, durationMs: 150, outputs: {} },
            { stepId: 's2', skillId: 'organize-downloads', status: 'completed', verified: true, durationMs: 150, outputs: {} },
          ],
        },
      }),
    ])

    expect(dashboardReport.system.overallSuccessRate).toBe(1)
    expect(dashboardReport.validatedPreferences.length).toBe(1)
    expect(dashboardReport.validatedPreferences[0]?.value).toBe('C:/Users/Raaz/AppData/Local/Reports')
  })
})
