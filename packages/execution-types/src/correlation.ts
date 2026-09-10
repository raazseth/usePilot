/**
 * Deterministic correlation chain tying every runtime entity
 * from ExecutionRun down to Manifest, Observation, and Timeline.
 */
export interface RuntimeCorrelationChain {
  runId: string
  traceId: string
  taskId?: string | undefined
  observationId?: string | undefined
  verificationId?: string | undefined
  replayStepId?: string | undefined
  manifestId?: string | undefined
}
