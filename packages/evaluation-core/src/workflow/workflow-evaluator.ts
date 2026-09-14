import type {
  ExecutionOutcome,
  WorkflowEvaluationMetrics,
  WorkflowReliability,
  WorkflowStepEvaluationMetrics,
  ReliabilityConfidenceLevel,
} from '@usepilot/evaluation-types'
import type { ComposedExecutionReceipt } from '@usepilot/skill-types'

export interface WorkflowCandidatePattern {
  skillSequence: string[]
  occurrenceCount: number
  successCount: number
  successRate: number
  avgDurationMs: number
  proposedWorkflowId: string
}

/**
 * WorkflowEvaluator — Evaluates workflows down to individual step execution.
 *
 * Responsibilities:
 * - Identifies step-level bottlenecks and high-retry hotspots.
 * - Tracks workflow reliability and replanning rates.
 * - Detects frequently succeeding skill patterns as workflow candidates.
 */
export class WorkflowEvaluator {
  private readonly outcomes: ExecutionOutcome[] = []
  private readonly receipts: ComposedExecutionReceipt[] = []

  record(outcome: ExecutionOutcome, receipt?: ComposedExecutionReceipt): void {
    this.outcomes.push(outcome)
    if (receipt) {
      this.receipts.push(receipt)
    }
  }

  recordBatch(items: Array<{ outcome: ExecutionOutcome; receipt?: ComposedExecutionReceipt }>): void {
    for (const item of items) {
      this.record(item.outcome, item.receipt)
    }
  }

  getOutcomes(): ExecutionOutcome[] {
    return [...this.outcomes]
  }

  getMetrics(workflowId: string, version?: string): WorkflowEvaluationMetrics {
    const relevant = this.outcomes.filter(
      (o) => o.workflowId === workflowId && (!version || o.workflowVersion === version)
    )

    const invocationCount = relevant.length
    if (invocationCount === 0) {
      return {
        workflowId,
        version: version ?? 'latest',
        invocationCount: 0,
        successCount: 0,
        successRate: 0,
        verificationSuccessRate: 0,
        failureCount: 0,
        failureRate: 0,
        retryCount: 0,
        replanCount: 0,
        averageDurationMs: 0,
        userCorrectionCount: 0,
        userRejectionCount: 0,
        steps: {},
      }
    }

    let successCount = 0
    let verificationSuccessCount = 0
    let failureCount = 0
    let totalRetries = 0
    let totalReplans = 0
    let totalDurationMs = 0
    let userCorrectionCount = 0
    let userRejectionCount = 0

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
      if (o.userCorrection) userCorrectionCount++
      if (o.userRejection) userRejectionCount++

      totalRetries += o.retryCount
      totalReplans += o.replanCount
      totalDurationMs += o.durationMs
    }

    // Evaluate step performance
    const relevantReceipts = this.receipts.filter((r) => r.compositionId === workflowId)
    const stepMetricsMap: Record<string, WorkflowStepEvaluationMetrics> = {}

    for (const receipt of relevantReceipts) {
      for (const step of receipt.stepReceipts) {
        const stepId = step.stepId
        if (!stepMetricsMap[stepId]) {
          stepMetricsMap[stepId] = {
            stepId,
            skillId: step.skillId ?? 'unknown',
            invocationCount: 0,
            successCount: 0,
            failureCount: 0,
            verificationSuccessCount: 0,
            retryCount: 0,
            averageDurationMs: 0,
            failureReasonFrequency: {},
          }
        }
        const sm = stepMetricsMap[stepId]
        if (!sm) continue
        sm.invocationCount++
        if (step.status === 'completed') sm.successCount++
        if (step.status === 'failed') sm.failureCount++
        if (step.verified) sm.verificationSuccessCount++
        const retries = typeof step.outputs?.['retryCount'] === 'number' ? step.outputs['retryCount'] : 0
        sm.retryCount += retries
        sm.averageDurationMs += step.durationMs ?? 0

        if (step.error) {
          sm.failureReasonFrequency[step.error] = (sm.failureReasonFrequency[step.error] ?? 0) + 1
        }
      }
    }

    // Normalize step metrics
    let bottleneckStep: string | undefined = undefined
    let maxFailureRate = -1

    for (const [stepId, sm] of Object.entries(stepMetricsMap)) {
      if (sm.invocationCount > 0) {
        sm.averageDurationMs = Math.round(sm.averageDurationMs / sm.invocationCount)
        const stepFailureRate = sm.failureCount / sm.invocationCount
        if (stepFailureRate > maxFailureRate && stepFailureRate > 0) {
          maxFailureRate = stepFailureRate
          bottleneckStep = stepId
        }
      }
    }

    return {
      workflowId,
      version: version ?? 'latest',
      invocationCount,
      successCount,
      successRate: Math.round((successCount / invocationCount) * 1000) / 1000,
      verificationSuccessRate: Math.round((verificationSuccessCount / invocationCount) * 1000) / 1000,
      failureCount,
      failureRate: Math.round((failureCount / invocationCount) * 1000) / 1000,
      retryCount: totalRetries,
      replanCount: totalReplans,
      averageDurationMs: Math.round(totalDurationMs / invocationCount),
      userCorrectionCount,
      userRejectionCount,
      steps: stepMetricsMap,
      bottleneckStep,
    }
  }

  getReliability(workflowId: string, version?: string): WorkflowReliability {
    const metrics = this.getMetrics(workflowId, version)
    const confidence = this.computeConfidenceLevel(metrics.invocationCount)

    const stepFailureRates: Record<string, number> = {}
    for (const [stepId, sm] of Object.entries(metrics.steps)) {
      stepFailureRates[stepId] =
        sm.invocationCount > 0 ? Math.round((sm.failureCount / sm.invocationCount) * 1000) / 1000 : 0
    }

    return {
      workflowId,
      version: version ?? 'latest',
      sampleCount: metrics.invocationCount,
      successCount: metrics.successCount,
      verificationCount: Math.round(metrics.invocationCount * metrics.verificationSuccessRate),
      successRate: metrics.successRate,
      verificationRate: metrics.verificationSuccessRate,
      stepFailureRates,
      mostCommonFailingStep: metrics.bottleneckStep,
      averageDurationMs: metrics.averageDurationMs,
      retryRate: metrics.invocationCount > 0 ? Math.round((metrics.retryCount / metrics.invocationCount) * 1000) / 1000 : 0,
      replanRate: metrics.invocationCount > 0 ? Math.round((metrics.replanCount / metrics.invocationCount) * 1000) / 1000 : 0,
      confidence,
      lastEvaluatedAt: Date.now(),
    }
  }

  detectCandidateWorkflows(minOccurrences = 3, minSuccessRate = 0.8): WorkflowCandidatePattern[] {
    const patternMap = new Map<string, { count: number; success: number; duration: number; sequence: string[] }>()

    for (const o of this.outcomes) {
      if (o.skillIds.length > 1) {
        const key = o.skillIds.join(' -> ')
        const existing = patternMap.get(key) ?? {
          count: 0,
          success: 0,
          duration: 0,
          sequence: [...o.skillIds],
        }
        existing.count++
        if (o.status === 'SUCCESS') {
          existing.success++
        }
        existing.duration += o.durationMs
        patternMap.set(key, existing)
      }
    }

    const candidates: WorkflowCandidatePattern[] = []
    for (const [, val] of patternMap.entries()) {
      if (val.count >= minOccurrences) {
        const rate = val.success / val.count
        if (rate >= minSuccessRate) {
          candidates.push({
            skillSequence: val.sequence,
            occurrenceCount: val.count,
            successCount: val.success,
            successRate: Math.round(rate * 1000) / 1000,
            avgDurationMs: Math.round(val.duration / val.count),
            proposedWorkflowId: val.sequence.join('-and-'),
          })
        }
      }
    }

    return candidates
  }

  computeConfidenceLevel(sampleCount: number): ReliabilityConfidenceLevel {
    if (sampleCount < 5) return 'NONE'
    if (sampleCount < 20) return 'LOW'
    if (sampleCount < 50) return 'MEDIUM'
    return 'HIGH'
  }

  clear(): void {
    this.outcomes.length = 0
    this.receipts.length = 0
  }
}
