// Execution Metrics Types

export interface ExecutionMetrics {
  runId: string
  traceId: string
  totalDurationMs: number
  taskDurations: Record<string, number>
  adapterSelections: Record<string, string>
  verificationLatencies: Record<string, number>
  retryCount: number
  approvalWaitTimeMs: number
  checkpointCount: number
  journalEntryCount: number
  cancellationCount: number
  recoveryCount: number
  // Capability cost & resource telemetry
  cpuTimeMs?: number | undefined
  memoryDeltaBytes?: number | undefined
  browserStartupCostMs?: number | undefined
  ocrDurationMs?: number | undefined
  screenshotCount?: number | undefined
  downloadSizeBytes?: number | undefined
  adapterUtilization?: Record<string, number> | undefined
}
