// ExecutionMetricsCollector — incremental per-run telemetry

import type { ExecutionMetrics } from '@usepilot/execution-types'

export class ExecutionMetricsCollector {
  private readonly startTime: number
  private taskDurations: Record<string, number> = {}
  private adapterSelections: Record<string, string> = {}
  private verificationLatencies: Record<string, number> = {}
  private retryCount = 0
  private approvalWaitStart: number | null = null
  private totalApprovalWaitMs = 0
  private checkpointCount = 0
  private journalEntryCount = 0
  private cancellationCount = 0
  private recoveryCount = 0

  constructor(
    private readonly runId: string,
    private readonly traceId: string
  ) {
    this.startTime = Date.now()
  }

  recordTaskDuration(taskId: string, durationMs: number): void {
    this.taskDurations[taskId] = durationMs
  }

  recordAdapterSelection(taskId: string, adapterName: string): void {
    this.adapterSelections[taskId] = adapterName
  }

  recordVerificationLatency(taskId: string, durationMs: number): void {
    this.verificationLatencies[taskId] = durationMs
  }

  recordRetry(): void {
    this.retryCount++
  }

  recordApprovalStarted(): void {
    this.approvalWaitStart = Date.now()
  }

  recordApprovalResolved(): void {
    if (this.approvalWaitStart !== null) {
      this.totalApprovalWaitMs += Date.now() - this.approvalWaitStart
      this.approvalWaitStart = null
    }
  }

  recordCheckpoint(): void {
    this.checkpointCount++
  }

  recordJournalEntry(): void {
    this.journalEntryCount++
  }

  recordCancellation(): void {
    this.cancellationCount++
  }

  recordRecovery(): void {
    this.recoveryCount++
  }

  finalize(): ExecutionMetrics {
    return {
      runId: this.runId,
      traceId: this.traceId,
      totalDurationMs: Date.now() - this.startTime,
      taskDurations: { ...this.taskDurations },
      adapterSelections: { ...this.adapterSelections },
      verificationLatencies: { ...this.verificationLatencies },
      retryCount: this.retryCount,
      approvalWaitTimeMs: this.totalApprovalWaitMs,
      checkpointCount: this.checkpointCount,
      journalEntryCount: this.journalEntryCount,
      cancellationCount: this.cancellationCount,
      recoveryCount: this.recoveryCount,
    }
  }
}
