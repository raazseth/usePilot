# Execution Checkpoints

Checkpoints provide crash tolerance and restartability for execution runs. They capture a snapshot of task states, retry counters, and approval states at key execution boundaries.

## Persistence Timing

Checkpoints are committed to SQLite via `CheckpointManager` at two deterministic points:
1. **At batch boundaries**: Immediately after an execution batch completes, before dispatching subsequent dependent batches.
2. **Before human approval**: Immediately before entering the `waiting_approval` state, ensuring safe process shutdown or suspension while awaiting user intervention.

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
  pendingApprovalTaskId?: string | undefined
  metadata: Record<string, unknown>
}
```

## Resume Semantics

On recovery:
- `CheckpointManager.restore(runId)` loads the most recent checkpoint snapshot.
- Tasks in `completedTaskIds` or `skippedTaskIds` are not re-executed.
- If the run was suspended waiting for approval, the approval gate is restored with `pendingApprovalTaskId`.
- The `TaskScheduler` partitions remaining tasks (`pendingTaskIds`) into subsequent executable batches.


## Timeline Integration

Every checkpoint event is indexed by the `ExecutionTimeline` via `checkpointId`. The timeline stores the reference to the checkpoint without duplicating the underlying task array payloads, preserving single-source-of-truth invariants.

