# ADR-016: Append-Only SQLite Execution Journal

## Context
Debugging multi-step agent actions requires deep observability, while safety considerations require a tamper-evident audit log of what operations were performed.

## Decision
Record every state transition, adapter invocation, retry, verification result, and human approval to an append-only `execution_journal` SQLite table.

## Consequences
- Full post-mortem observability for every execution run.
- Immutable timeline that survives application crashes or restarts.
- Zero in-place row mutations on journal records.

> [!NOTE]
> Large binary payloads (screenshots, DOM snapshots) are offloaded to disk via [ADR-031](ADR-031-runtime-artifact-store.md), while journals serve as the foundation for deterministic execution replay ([ADR-034](ADR-034-execution-replay.md)) and failure bundles ([ADR-035](ADR-035-failure-bundle.md)).

