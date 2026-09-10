# Execution Journal

The `ExecutionJournal` is an append-only audit trail capturing every state change, adapter invocation, approval, and verification during an execution run.

## Audit Guarantees

1. **Append-Only**: Entries are strictly inserted; updates and deletions never occur.
2. **Deterministic Sequence**: Monotonic timestamping and ordering provide a fully reproducible forensic timeline.
3. **Structured Payload**: Arbitrary JSON payload allows deep forensic inspection of adapter inputs, outputs, error stacks, and system metrics.
4. **Correlation Tracking**: Every entry carries a `traceId` and optional `taskId` matching the `RuntimeCorrelationChain`.

## Data Schema

```typescript
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
```

## Event Types

- **Lifecycle**: `execution_started`, `execution_paused`, `execution_resumed`, `execution_completed`, `execution_failed`, `execution_cancelled`
- **Task**: `task_started`, `task_completed`, `task_failed`, `task_skipped`, `task_retrying`
- **Adapter**: `adapter_selected`, `adapter_result`, `verification_result`
- **Human In The Loop**: `approval_requested`, `approval_received`
- **Checkpoints & Transitions**: `checkpoint_created`, `checkpoint_restored`, `state_transition`

## Timeline Indexing

The journal acts as the primary event log. Higher-level inspection surfaces access journal records through the `ExecutionTimeline`, which maintains a lightweight sequential index containing `journalEntryId` references rather than duplicating log data.

