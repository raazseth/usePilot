import type {
  ExecutionOutcome,
  SystemEvaluationMetrics,
  SkillReliability,
  UserPreference,
} from '@usepilot/evaluation-types'

import type { AgentEvaluator } from '../agent/agent-evaluator'
import type { PreferenceEngine } from '../personalization/preference-engine'
import type { RegressionManager } from '../regression/regression-manager'
import type { SkillEvaluator } from '../skill/skill-evaluator'
import type { WorkflowEvaluator } from '../workflow/workflow-evaluator'

export interface OperationalDashboardReport {
  system: SystemEvaluationMetrics
  topReliableSkills: SkillReliability[]
  leastReliableSkills: SkillReliability[]
  workflowBottlenecks: Array<{ workflowId: string; bottleneckStep?: string | undefined; failureRate: number }>
  candidatePreferences: UserPreference[]
  validatedPreferences: UserPreference[]
  pendingRegressionCases: number
  generatedAt: number
}

/**
 * EvaluationDashboard — Aggregates operational health and learning telemetry.
 *
 * Privacy Invariant: Operates 100% locally. Contains zero passwords, auth tokens,
 * session cookies, or raw private files. Minimizes stored data to operational metrics.
 */
export class EvaluationDashboard {
  constructor(
    private readonly skillEvaluator: SkillEvaluator,
    private readonly workflowEvaluator: WorkflowEvaluator,
    private readonly agentEvaluator: AgentEvaluator,
    private readonly preferenceEngine: PreferenceEngine,
    private readonly regressionManager: RegressionManager
  ) {}

  generateReport(allOutcomes: ExecutionOutcome[]): OperationalDashboardReport {
    const totalExecutions = allOutcomes.length

    let successCount = 0
    let verificationCount = 0
    let clarificationCount = 0
    let totalReplans = 0
    let totalRetries = 0
    const failureCategories: Record<string, number> = {}

    for (const o of allOutcomes) {
      if (o.status === 'SUCCESS' || o.status === 'PARTIAL_SUCCESS') successCount++
      if (o.verificationStatus) verificationCount++
      if (o.status === 'CLARIFICATION_REQUIRED') clarificationCount++
      totalReplans += o.replanCount
      totalRetries += o.retryCount
      if (o.failureCategory) {
        failureCategories[o.failureCategory] = (failureCategories[o.failureCategory] ?? 0) + 1
      }
    }

    const system: SystemEvaluationMetrics = {
      totalExecutions,
      overallSuccessRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 1000) / 1000 : 0,
      verificationSuccessRate: totalExecutions > 0 ? Math.round((verificationCount / totalExecutions) * 1000) / 1000 : 0,
      clarificationRate: totalExecutions > 0 ? Math.round((clarificationCount / totalExecutions) * 1000) / 1000 : 0,
      totalReplans,
      totalRetries,
      topFailureCategories: failureCategories,
    }

    // Skill reliability rankings
    const skillIds = Array.from(new Set(allOutcomes.flatMap((o) => o.skillIds)))
    const skillReliabilities: SkillReliability[] = skillIds.map((id) =>
      this.skillEvaluator.getReliability(id)
    )

    skillReliabilities.sort((a, b) => b.verificationRate - a.verificationRate)

    const topReliableSkills = skillReliabilities.slice(0, 5)
    const leastReliableSkills = [...skillReliabilities]
      .reverse()
      .filter((s) => s.sampleCount > 0)
      .slice(0, 5)

    // Workflow bottlenecks
    const workflowIds = Array.from(
      new Set(allOutcomes.map((o) => o.workflowId).filter((id): id is string => Boolean(id)))
    )
    const workflowBottlenecks = workflowIds.map((wfId) => {
      const rel = this.workflowEvaluator.getReliability(wfId)
      return {
        workflowId: wfId,
        bottleneckStep: rel.mostCommonFailingStep,
        failureRate: Math.round((1 - rel.successRate) * 1000) / 1000,
      }
    })

    // Preferences
    const validatedPreferences = this.preferenceEngine.listValidatedPreferences()
    const allPrefs = [
      this.preferenceEngine.getPreference('download_directory'),
      this.preferenceEngine.getPreference('preferred_browser'),
      this.preferenceEngine.getPreference('file_naming_style'),
    ].filter((p): p is UserPreference => Boolean(p))

    const candidatePreferences = allPrefs.filter((p) => p.status === 'CANDIDATE')

    return {
      system,
      topReliableSkills,
      leastReliableSkills,
      workflowBottlenecks,
      candidatePreferences,
      validatedPreferences,
      pendingRegressionCases: this.regressionManager.listCases().length,
      generatedAt: Date.now(),
    }
  }
}
