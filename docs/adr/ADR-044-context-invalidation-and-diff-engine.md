# ADR-044: Context Invalidation Engine, Read-Only Query Contract, and Context Diff Engine

## Status
Accepted

## Context
As usePilot executes operations across multi-page web applications, desktop windows, and filesystem states, two critical hazards emerge:
1. **Operating on Stale State**: External changes (user logout, website DOM redesign, file deletion, window closure, permission revocation) render previously accumulated knowledge invalid. Relying solely on passive TTL expiration leaves a window of vulnerability where stale routes or permissions are reused.
2. **State Mutation from Query Layers**: Allowing callers (Planner, Services, UI) to mutate runtime context via query handlers violates deterministic execution and introduces non-reproducible race conditions.
3. **Black-box Snapshot Evolution**: While immutable `ContextSnapshot`s are recorded, observing the delta between arbitrary steps requires deterministic, structured comparison across all runtime slices.

## Decision

### 1. Deterministic Context Invalidation (`ContextInvalidationEngine`)
We introduce `ContextInvalidationEngine` to deterministically purge and update state upon runtime triggers:
- `user_logout`: Clears authentication flags in `BrowserKnowledgeGraph`, purges authenticated observations and credentials.
- `website_redesign`: Invalidates cached domain routes and actions in `BrowserKnowledgeGraph` when fingerprint mismatches or DOM changes occur.
- `file_deleted`: Purges entries from `RuntimeIndexEngine`, removes `File` entities and relationships from `RuntimeEntityGraph`, and cleans filesystem observations.
- `window_closed`: Purges `Window` entities and associated desktop observations.
- `permission_revoked`: Purges `Permission` nodes and edges from `RuntimeEntityGraph`.
- Emits typed `InvalidationEvent`s to subscribers for real-time reactive UI and logging.

### 2. Strict Read-Only `RuntimeQueryEngine` Contract
We formally restrict `RuntimeQueryEngine` to a strictly read-only interface:
```
Planner / UI / External Consumers
         ↓ (READ ONLY)
RuntimeQueryEngine
         ↓ (READS)
  RuntimeContext
         ↑ (WRITES ONLY)
ObservationEngine / Capability Runtime / Execution
```
- Invariants:
  - `RuntimeQueryEngine` exposes zero mutation, creation, or deletion methods.
  - All writes to `RuntimeContext` originate exclusively from `ObservationEngine`, `Capability Runtime`, or `ExecutionRunner`.
  - Collections returned by query methods represent immutable snapshots or defensive copies.

### 3. Context Diff Engine (`ContextDiffEngine`)
We implement `ContextDiffEngine.diff(snapshotA, snapshotB)`:
- Computes deterministic deltas across all runtime slices (`browser`, `desktop`, `filesystem`, `customEntries`).
- Categorizes changes into `added`, `removed`, and `modified` (with `{ before, after }` values).
- Generates human-readable summary strings for execution replay, diagnostics, and debugging.

## Consequences
- Guarantees that neither the Planner nor the Execution Engine operates on stale web topology, deleted files, or revoked permissions.
- Preserves clean architectural boundaries between reading (queries) and writing (observations & execution).
- Enables instant visual and programmatic diffs across execution replay steps.
