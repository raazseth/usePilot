// Execution Journal Types

export type JournalEventType =
  | 'execution_started'
  | 'execution_paused'
  | 'execution_resumed'
  | 'execution_completed'
  | 'execution_failed'
  | 'execution_cancelled'
  | 'task_started'
  | 'task_completed'
  | 'task_failed'
  | 'task_skipped'
  | 'task_retrying'
  | 'adapter_selected'
  | 'adapter_result'
  | 'verification_result'
  | 'approval_requested'
  | 'approval_received'
  | 'checkpoint_created'
  | 'checkpoint_restored'
  | 'state_transition'

export interface JournalEntry {
  id: string
  runId: string
  traceId: string
  taskId?: string | undefined
  eventType: JournalEventType
  adapterName?: string | undefined
  stateFrom?: string | undefined
  stateTo?: string | undefined
  attemptNumber?: number | undefined
  payload: Record<string, unknown>
  timestamp: number
}
