# System Ownership & Lifecycle Matrix

This document defines the definitive ownership, mutability, lifecycle, and persistence boundaries for all primary data structures and runtime entities in usePilot.

---

## 1. Ownership & Mutability Matrix

| Object | Owner Subsystem | Mutable By | Lifetime | Storage Tier & Persistence | Core Invariants |
|---|---|---|---|---|---|
| **`ExecutionBlueprint`** | `@usepilot/planner-core` | Planner pipeline only (stages 1–11); immutable once serialized | Created during planning; persists indefinitely | SQLite `plans` table | Stamped with canonical SHA-256 `blueprint.hash`. Guaranteed acyclic DAG. Immutable once handed to execution. |
| **`ExecutionRun`** | `@usepilot/execution-core` | `ExecutionRunner` and `ExecutionStateMachine` | Execution lifecycle | SQLite `execution_runs` table | Governed by strict state machine transitions (`created` → `running` → terminal). |
| **`ExecutionJournal`** | `@usepilot/execution-core` | `ExecutionRunner` (strictly append-only) | Persists permanently | SQLite `execution_journal` table | Append-only audit log. Zero in-place row mutations. Monotonic timestamp ordering. |
| **`ExecutionTimeline`** | `@usepilot/execution-core` | `ExecutionRunner` | Duration of execution run; included in `ExecutionReport` | In-memory index of references; serialized into reports | Zero object duplication. Contains only references (`taskId`, `journalEntryId`, `observationId`, `verificationId`, `checkpointId`). |
| **`ExecutionCheckpoint`** | `@usepilot/execution-core` | `CheckpointManager` | Active run until completion; retained for crash recovery | SQLite `execution_checkpoints` table | Committed strictly at batch boundaries and immediately before entering `waiting_approval`. |
| **`ExecutionManifest`** | `@usepilot/execution-core` | `ManifestGenerator` (written once at completion) | Permanent | SQLite `execution_manifests` table | Immutable cryptographic receipt. Sealed with SHA-256 `manifestHash` over normalized canonical JSON payload. |
| **`FailureBundle`** | `@usepilot/execution-core` | `FailureBundleGenerator` (written once on terminal failure) | Permanent on disk | Local filesystem directory `artifacts/<executionId>/failure-bundle/` | Self-contained forensic archive bundling failure manifest, journal entries, verification failures, and disk artifacts. |
| **`Observation`** | `@usepilot/runtime-context` | Emitted by adapters; rollbackable by `ContextTransactionRunner` | Hot memory (ring buffer) → Warm query index | Hot in-memory ring buffer (bounded capacity); warm disk index | Read-only perception data. Cannot be updated in-place; can only be evicted by FIFO buffer bounds or purged via transaction rollback. |
| **`RuntimeContextState`** | `@usepilot/runtime-context` | `facade.state.update()` or `facade.transaction()` | Active session | Hot in-memory store; periodic immutable snapshots | Optimistic concurrency control with rollback support. Validated against `contextSchemaVersion`. |
| **`BrowserKnowledgeGraph`** | `@usepilot/runtime-context` | `facade.knowledge.recordPage()`, `recordAction()` | Workspace persistent | Warm storage tier (local disk / SQLite) | Domain route topologies and form models. Evaluated with TTL-based staleness policies. |
| **`RuntimeEntityGraph`** | `@usepilot/runtime-context` | `facade.entities.addNode()`, `link()` | Workspace persistent | Warm storage tier (local disk) | Directed graph supporting multi-hop traversals. Compensating rollback on aborted transactions. |
| **`KnowledgeItem`** | `@usepilot/runtime-context` | `facade.knowledge.set()`, `invalidate()` | Long-term persistent | Warm storage tier (local SQLite / disk) | Keyed by namespace + key. Tracks confidence score, access frequency, and last verified timestamp. |
| **`Artifact`** | `@usepilot/execution-core` | Written once by adapters/subsystems via `ArtifactStore.save()` | Execution run or permanent | Local filesystem (`.usepilot/artifacts/<executionId>/...`) | Large binary assets (screenshots, DOM dumps, traces, downloads) offloaded from SQLite. Virtual URI addressing. |
| **`AdapterSession`** | `@usepilot/execution-core` | `SessionManager` | Scoped to `capability`, `run`, or `task` | In-memory runtime resource | Pooled active process/handle wrapper. Guaranteed cleanup and disposal via `IResourceManager` on run completion. |
| **`ReplaySession`** | `@usepilot/execution-core` & `@usepilot/runtime-context` | Replay runner during step-through | Ephemeral debugging session | Transient memory | Read-only execution simulation. Zero physical side effects dispatched to external OS or network targets. |

---

## 2. Storage Tier Ownership & Eviction Rules

usePilot enforces a 3-tier storage architecture to prevent memory leaks and unconstrained disk growth:

```text
┌─────────────────────────────────────────────────────────────┐
│ HOT TIER (In-Memory, Low Latency, Volatile)                 │
│ • Current active browser state, tab handles, cwd            │
│ • Active AdapterSessions & process handles                  │
│ • ObservationEngine ring buffer (capacity: 1,000 entries)    │
│ • ExecutionStateMachine current status                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ Snapshot / Flush
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ WARM TIER (Local Disk / SQLite, Operational Topologies)     │
│ • KnowledgeStore persistent facts & operational rules       │
│ • BrowserKnowledgeGraph route topologies & form selectors   │
│ • RuntimeEntityGraph nodes & relationship edges             │
│ • Hybrid RuntimeIndex (BM25 + vector index)                 │
│ Eviction: LRU with TTL staleness checks via StorageManager   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Run Completion / Archive
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ COLD TIER (Durable Archival, Immutable Audit Receipts)       │
│ • ExecutionManifest (cryptographic receipt in SQLite)       │
│ • ExecutionJournal (append-only SQLite table)               │
│ • ArtifactStore (raw screenshots, trace zips on disk)       │
│ • FailureBundles (post-mortem diagnostic packages)          │
│ Retention: Governed by user-configured disk quota           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Mutation Boundaries

1. **Planner Boundary**:
   - The planner NEVER mutates execution state, database execution runs, or capability adapters.
   - The planner produces an immutable `ExecutionBlueprint` and commits it to SQLite.
2. **Execution Boundary**:
   - The execution runner NEVER modifies the input `ExecutionBlueprint`.
   - All runtime state transitions are mediated exclusively through the `ExecutionStateMachine`.
   - All external tool interactions pass through `AdapterSandbox`.
3. **Runtime Context Boundary**:
   - External callers (Planner, Execution, Backend) NEVER import internal store classes (`MemoryContextStore`, `KnowledgeStore`, `ObservationEngine`) directly.
   - All reads and mutations pass through the `RuntimeContextFacade`.
   - Multi-subsystem mutations must execute inside `facade.transaction(async (tx) => { ... })` to ensure atomic rollbacks upon failure.
