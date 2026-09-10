// Execution Timeline Types — Index of references without object duplication

export type TimelineEventType =
  | 'task_started'
  | 'observation'
  | 'verification'
  | 'retry'
  | 'checkpoint'
  | 'task_completed'
  | 'task_failed'
  | 'cancelled'

export interface ExecutionTimelineEntry {
  readonly sequence: number
  readonly timestamp: number
  readonly type: TimelineEventType
  readonly runId: string
  readonly summary: string
  // References — orchestrates references to underlying source-of-truth entities
  readonly taskId?: string | undefined
  readonly journalEntryId?: string | undefined
  readonly observationId?: string | undefined
  readonly verificationId?: string | undefined
  readonly checkpointId?: string | undefined
  readonly replayStepId?: string | undefined
}

export interface ExecutionTimeline {
  readonly runId: string
  readonly traceId: string
  readonly startedAt: number
  readonly completedAt?: number | undefined
  readonly entries: readonly ExecutionTimelineEntry[]
}
