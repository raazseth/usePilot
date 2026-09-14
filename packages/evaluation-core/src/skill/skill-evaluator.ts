import type {
  ExecutionOutcome,
  SkillEvaluationMetrics,
  SkillReliability,
  ReliabilityConfidenceLevel,
} from '@usepilot/evaluation-types'

export interface SkillVersionComparison {
  skillId: string
  versionA: string
  versionB: string
  sampleCountA: number
  sampleCountB: number
  successRateA: number
  successRateB: number
  verificationRateA: number
  verificationRateB: number
  avgDurationDiffMs: number
  superiorVersion?: string | undefined
  recommendation: string
}

/**
 * SkillEvaluator — Computes statistical reliability and operational metrics
 * for individual Skills and Skill versions based on real execution evidence.
 *
 * Implements sample-size aware reliability: small samples (e.g. 2/2) do not report
 * false 100% confidence; confidence scales with statistical evidence.
 */
export class SkillEvaluator {
  private readonly outcomes: ExecutionOutcome[] = []

  record(outcome: ExecutionOutcome): void {
    this.outcomes.push(outcome)
  }

  recordBatch(outcomes: ExecutionOutcome[]): void {
    this.outcomes.push(...outcomes)
  }

  getMetrics(skillId: string, version?: string): SkillEvaluationMetrics {
    const relevant = this.outcomes.filter(
      (o) => o.skillIds.includes(skillId) && (!version || o.skillVersions[skillId] === version)
    )

    const invocationCount = relevant.length
    if (invocationCount === 0) {
      return {
        skillId,
        version: version ?? 'latest',
        invocationCount: 0,
        successCount: 0,
        successRate: 0,
        verificationSuccessCount: 0,
        verificationSuccessRate: 0,
        failureCount: 0,
        failureRate: 0,
        retryCount: 0,
        retryRate: 0,
        recoveryCount: 0,
        recoveryRate: 0,
        averageDurationMs: 0,
        clarificationCount: 0,
        clarificationFrequency: 0,
        userCorrectionCount: 0,
        userCorrectionRate: 0,
        userRejectionCount: 0,
        userRejectionRate: 0,
        reuseFrequency: 0,
        failureCategories: {},
      }
    }

    let successCount = 0
    let verificationSuccessCount = 0
    let failureCount = 0
    let retryCount = 0
    let recoveryCount = 0
    let totalDurationMs = 0
    let clarificationCount = 0
    let userCorrectionCount = 0
    let userRejectionCount = 0
    const failureCategories: Record<string, number> = {}

    for (const o of relevant) {
      if (o.status === 'SUCCESS' || o.status === 'PARTIAL_SUCCESS') {
        successCount++
      }
      if (o.verificationStatus) {
        verificationSuccessCount++
      }
      if (o.status === 'FAILED' || o.status === 'VERIFICATION_FAILURE') {
        failureCount++
      }
      if (o.status === 'CLARIFICATION_REQUIRED') {
        clarificationCount++
      }
      if (o.userCorrection) {
        userCorrectionCount++
      }
      if (o.userRejection) {
        userRejectionCount++
      }
      if (o.replanCount > 0 && (o.status === 'SUCCESS' || o.status === 'PARTIAL_SUCCESS')) {
        recoveryCount++
      }

      retryCount += o.retryCount
      totalDurationMs += o.durationMs

      if (o.failureCategory) {
        failureCategories[o.failureCategory] = (failureCategories[o.failureCategory] ?? 0) + 1
      }
    }

    return {
      skillId,
      version: version ?? 'latest',
      invocationCount,
      successCount,
      successRate: Math.round((successCount / invocationCount) * 1000) / 1000,
      verificationSuccessCount,
      verificationSuccessRate: Math.round((verificationSuccessCount / invocationCount) * 1000) / 1000,
      failureCount,
      failureRate: Math.round((failureCount / invocationCount) * 1000) / 1000,
      retryCount,
      retryRate: Math.round((retryCount / invocationCount) * 1000) / 1000,
      recoveryCount,
      recoveryRate: Math.round((recoveryCount / invocationCount) * 1000) / 1000,
      averageDurationMs: Math.round(totalDurationMs / invocationCount),
      clarificationCount,
      clarificationFrequency: Math.round((clarificationCount / invocationCount) * 1000) / 1000,
      userCorrectionCount,
      userCorrectionRate: Math.round((userCorrectionCount / invocationCount) * 1000) / 1000,
      userRejectionCount,
      userRejectionRate: Math.round((userRejectionCount / invocationCount) * 1000) / 1000,
      reuseFrequency: invocationCount,
      failureCategories,
    }
  }

  getReliability(skillId: string, version?: string): SkillReliability {
    const metrics = this.getMetrics(skillId, version)
    const confidence = this.computeConfidenceLevel(metrics.invocationCount)

    return {
      skillId,
      version: version ?? 'latest',
      sampleCount: metrics.invocationCount,
      successCount: metrics.successCount,
      verificationCount: metrics.verificationSuccessCount,
      successRate: metrics.successRate,
      verificationRate: metrics.verificationSuccessRate,
      retryRate: metrics.retryRate,
      failureRate: metrics.failureRate,
      confidence,
      lastEvaluatedAt: Date.now(),
    }
  }

  compareVersions(skillId: string, versionA: string, versionB: string): SkillVersionComparison {
    const metricsA = this.getMetrics(skillId, versionA)
    const metricsB = this.getMetrics(skillId, versionB)

    const diffDuration = metricsB.averageDurationMs - metricsA.averageDurationMs

    let superiorVersion: string | undefined = undefined
    let recommendation = ''

    if (metricsA.invocationCount < 5 && metricsB.invocationCount < 5) {
      recommendation = 'Insufficient evidence for both versions; continue sampling.'
    } else if (metricsB.invocationCount >= 5 && metricsB.verificationSuccessRate > metricsA.verificationSuccessRate) {
      superiorVersion = versionB
      recommendation = `Version ${versionB} shows higher verified reliability (${(metricsB.verificationSuccessRate * 100).toFixed(1)}% vs ${(metricsA.verificationSuccessRate * 100).toFixed(1)}%).`
    } else if (metricsA.invocationCount >= 5 && metricsA.verificationSuccessRate > metricsB.verificationSuccessRate) {
      superiorVersion = versionA
      recommendation = `Version ${versionA} shows higher verified reliability (${(metricsA.verificationSuccessRate * 100).toFixed(1)}% vs ${(metricsB.verificationSuccessRate * 100).toFixed(1)}%).`
    } else {
      recommendation = `Both versions show comparable verified reliability.`
    }

    return {
      skillId,
      versionA,
      versionB,
      sampleCountA: metricsA.invocationCount,
      sampleCountB: metricsB.invocationCount,
      successRateA: metricsA.successRate,
      successRateB: metricsB.successRate,
      verificationRateA: metricsA.verificationSuccessRate,
      verificationRateB: metricsB.verificationSuccessRate,
      avgDurationDiffMs: diffDuration,
      superiorVersion,
      recommendation,
    }
  }

  computeConfidenceLevel(sampleCount: number): ReliabilityConfidenceLevel {
    if (sampleCount < 5) return 'NONE'
    if (sampleCount < 20) return 'LOW'
    if (sampleCount < 50) return 'MEDIUM'
    return 'HIGH'
  }

  clear(): void {
    this.outcomes.length = 0
  }
}
