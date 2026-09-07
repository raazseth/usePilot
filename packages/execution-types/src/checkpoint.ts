// Checkpoint Types

import type { ExecutionStatus } from './execution'

export interface ExecutionCheckpoint {
  id: string
  runId: string
  createdAt: number
  executionStatus: ExecutionStatus
  completedTaskIds: string[]
  pendingTaskIds: string[]
  failedTaskIds: string[]
  skippedTaskIds: string[]
  retryCounters: Record<string, number>
  pendingApprovalTaskId?: string | undefined
  metadata: Record<string, unknown>
}
