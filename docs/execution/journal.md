# Execution Journal

The `ExecutionJournal` is an append-only audit trail capturing every state change, adapter invocation, approval, and verification during an execution run.

## Audit Guarantees

1. **Append-Only**: Entries are strictly inserted; updates or deletions never occur.
2. **Deterministic Sequence**: Monotonic timestamping and order provide a reproducible timeline.
3. **Structured Payload**: Arbitrary JSON payload allows deep forensic inspection of adapter inputs, outputs, and errors.

## Event Types

- `execution_started`, `execution_paused`, `execution_resumed`, `execution_completed`, `execution_failed`, `execution_cancelled`
- `task_started`, `task_completed`, `task_failed`, `task_skipped`, `task_retrying`
- `adapter_selected`, `adapter_result`, `verification_result`
- `approval_requested`, `approval_received`
- `checkpoint_created`, `checkpoint_restored`, `state_transition`
