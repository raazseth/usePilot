# ADR-017: Batch and Approval Checkpoint Strategy

## Context
Long-running workflows can fail or the application process can be closed during execution or while waiting for human approvals.

## Decision
Save execution snapshots into `execution_checkpoints` at each batch boundary and immediately prior to requesting user approval. On restart, `CheckpointManager.restore()` reconstructs the run state without re-executing finished tasks.

## Consequences
- Workflows are resilient against app restarts and power loss.
- Completed tasks are strictly idempotent and never executed twice.
- Pending approvals survive client reconnection seamlessly.
