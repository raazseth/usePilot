import type { SkillExecutionTelemetry } from '@usepilot/skill-types'

export interface SkillAggregatedMetrics {
  skillId: string
  totalRuns: number
  totalExecutions: number
  successfulRuns: number
  verificationSuccesses: number
  successRate: number
  avgDurationMs: number
  totalRetries: number
  failureCategories: Record<string, number>
  approvalsRequested: number
  approvalsGranted: number
}

/**
 * SkillTelemetryCollector — Aggregates Skill execution observability.
 *
 * Answers:
 * - Which Skills actually work?
 * - Which Skills are repeatedly useful?
 * - What are the primary failure categories for each Skill?
 */
export class SkillTelemetryCollector {
  private readonly records: SkillExecutionTelemetry[] = []

  record(telemetry: SkillExecutionTelemetry): void {
    this.records.push({ ...telemetry })
  }

  getRecords(skillId?: string): SkillExecutionTelemetry[] {
    if (!skillId) return [...this.records]
    return this.records.filter((r) => r.skillId === skillId)
  }

  getMetrics(skillId: string): SkillAggregatedMetrics {
    const relevant = this.getRecords(skillId)
    const totalRuns = relevant.length

    if (totalRuns === 0) {
      return {
        skillId,
        totalRuns: 0,
        totalExecutions: 0,
        successfulRuns: 0,
        verificationSuccesses: 0,
        successRate: 0,
        avgDurationMs: 0,
        totalRetries: 0,
        failureCategories: {},
        approvalsRequested: 0,
        approvalsGranted: 0,
      }
    }

    let successfulRuns = 0
    let verificationSuccesses = 0
    let totalDurationMs = 0
    let totalRetries = 0
    let approvalsRequested = 0
    let approvalsGranted = 0
    const failureCategories: Record<string, number> = {}

    for (const r of relevant) {
      if (r.success) successfulRuns++
      if (r.verificationSuccess) verificationSuccesses++
      totalDurationMs += r.durationMs
      totalRetries += r.retryCount
      if (r.approvalRequired) approvalsRequested++
      if (r.approvalGranted) approvalsGranted++

      if (r.failureCategory) {
        failureCategories[r.failureCategory] = (failureCategories[r.failureCategory] ?? 0) + 1
      }
    }

    return {
      skillId,
      totalRuns,
      totalExecutions: totalRuns,
      successfulRuns,
      verificationSuccesses,
      successRate: Math.round((successfulRuns / totalRuns) * 100) / 100,
      avgDurationMs: Math.round(totalDurationMs / totalRuns),
      totalRetries,
      failureCategories,
      approvalsRequested,
      approvalsGranted,
    }
  }

  listMetrics(): Record<string, SkillAggregatedMetrics> {
    const skillIds = Array.from(new Set(this.records.map((r) => r.skillId)))
    const result: Record<string, SkillAggregatedMetrics> = {}
    for (const id of skillIds) {
      result[id] = this.getMetrics(id)
    }
    return result
  }

  clear(): void {
    this.records.length = 0
  }
}
