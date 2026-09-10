// ExecutionTimelineBuilder — builds unified chronological execution timeline indexing references

import type {
  ExecutionTimeline,
  ExecutionTimelineEntry,
  TimelineEventType,
  JournalEntry,
} from '@usepilot/execution-types'

export class ExecutionTimelineBuilder {
  static fromJournal(
    runId: string,
    traceId: string,
    entries: JournalEntry[],
    completedAt?: number
  ): ExecutionTimeline {
    const startedAt = entries.length > 0 ? entries[0]!.timestamp : Date.now()
    const timelineEntries: ExecutionTimelineEntry[] = entries.map((entry, idx) => {
      let type: TimelineEventType = 'task_started'
      let summary = entry.eventType.replace(/_/g, ' ')

      switch (entry.eventType) {
        case 'task_started':
          type = 'task_started'
          summary = `Task ${entry.payload['taskTitle'] ?? entry.taskId ?? 'unnamed'} started`
          break
        case 'task_completed':
          type = 'task_completed'
          summary = `Task ${entry.taskId ?? ''} completed in ${entry.payload['durationMs']}ms`
          break
        case 'task_failed':
          type = 'task_failed'
          summary = `Task ${entry.taskId ?? ''} failed: ${entry.payload['error']}`
          break
        case 'verification_result':
          type = 'verification'
          summary = `Task ${entry.taskId ?? ''} state verification: ${entry.payload['passed'] ? 'passed' : 'failed'}`
          break
        case 'task_retrying':
          type = 'retry'
          summary = `Task ${entry.taskId ?? ''} retrying attempt ${entry.payload['attempt'] ?? entry.attemptNumber}`
          break
        case 'checkpoint_created':
        case 'checkpoint_restored':
          type = 'checkpoint'
          summary = `Checkpoint ${entry.eventType === 'checkpoint_created' ? 'persisted' : 'restored'}`
          break
        case 'execution_cancelled':
          type = 'cancelled'
          summary = 'Execution cancelled by operator'
          break
        default:
          type = 'observation'
          summary = `Runtime event: ${entry.eventType}`
      }

      return {
        sequence: idx + 1,
        timestamp: entry.timestamp,
        type,
        runId,
        taskId: entry.taskId,
        journalEntryId: entry.id,
        checkpointId: typeof entry.payload['checkpointId'] === 'string' ? entry.payload['checkpointId'] : undefined,
        verificationId: typeof entry.payload['verificationId'] === 'string' ? entry.payload['verificationId'] : undefined,
        observationId: typeof entry.payload['observationId'] === 'string' ? entry.payload['observationId'] : undefined,
        replayStepId: typeof entry.payload['replayStepId'] === 'string' ? entry.payload['replayStepId'] : undefined,
        summary,
      }
    })

    return {
      runId,
      traceId,
      startedAt,
      completedAt,
      entries: timelineEntries,
    }
  }
}
