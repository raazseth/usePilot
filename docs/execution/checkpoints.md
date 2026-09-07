# Execution Checkpoints

Checkpoints provide crash tolerance and restartability for execution runs.

## Persistence Timing

Checkpoints are committed to SQLite in two critical situations:
1. **At batch boundaries**: After each execution batch completes.
2. **Before human approval**: Immediately before entering `waiting_approval` state.

## Data Structure

```typescript
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
  pendingApprovalTaskId?: string
  metadata: Record<string, unknown>
}
```

## Resume Semantics

On recovery:
- `CheckpointManager.restore()` loads the latest snapshot.
- Tasks in `completedTaskIds` or `skippedTaskIds` are not re-executed.
- If the run was suspended waiting for approval, the approval gate is re-established.
