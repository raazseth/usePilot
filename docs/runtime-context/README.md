# Runtime Context Subsystem

Runtime Context (`@usepilot/runtime-context`) is the state-awareness engine of usePilot, providing an isolated, deterministic, content-addressed memory model that decouples cognitive planning and execution from low-level automation side effects.

---

## Purpose

Autonomous computer-use assistants face a fundamental reliability hazard: if a cognitive planner directly queries live operating system resources (such as active browser DOM trees, window handles, or open sockets), planning decisions become non-deterministic, tightly coupled to platform quirks, and impossible to replay or audit. Conversely, if an execution engine mutates system state without tracking provenance or causal relationships, recovery from unexpected failures becomes guesswork.

The Runtime Context Subsystem resolves this by providing a unified, in-process state-awareness layer that acts as the single source of truth for the entire application.

### What It Owns

- **Hot Session State**: Real-time structured perceptions of active browser windows, desktop processes, and filesystem paths.
- **Context Provenance**: Strict causal tracking of every state mutation, associating timestamps, sources, confidence scores, and correlation chains.
- **Relational Entity Graph**: An in-memory bidirectional property graph tracking entities (`Website`, `Document`, `File`, `Execution`, `Task`) and their relationships (`opened`, `downloaded`, `generated`, `depends_on`, `verified_by`).
- **Domain Knowledge Store**: Structured caching of long-lived assets, including website form descriptors, navigation routes, document extracts, and persistent facts.
- **Runtime Semantic Index**: Inverted search index for instant keyword and type-filtered retrieval across OCR outputs, downloads, and DOM extractions.
- **Observation Pipeline**: A typed stream of environmental perception frames separated strictly from temporal execution journal events.
- **Deterministic Replay**: Point-in-time state reconstruction allowing operators to step through recorded perceptual frames frame-by-frame.
- **Storage Tiering & Invalidation**: Lifecycle management across Hot, Warm, and Cold storage tiers, with deterministic cascading cache invalidation.

### What It Does NOT Own

- **Direct OS or Hardware Automation**: It does not launch browsers, spawn native processes, or manipulate hardware input. Those responsibilities belong exclusively to Capability Adapters in `@usepilot/execution-core`.
- **Cognitive Decomposition**: It does not formulate execution plans, evaluate natural language goals, or query LLMs. Those responsibilities belong to `@usepilot/planner-core`.
- **Database Persistence**: While it emits immutable snapshots, long-term disk-backed persistence of user conversations and execution journals is owned by `@usepilot/database`.

---

## Design Principles

### 1. Separation of Perception and Execution

Adapters observe the world and emit typed observations; they never directly modify planner state. The planner queries runtime context perceptions; it never interacts with adapters directly. This hard boundary prevents runtime state leakage and guarantees that planning decisions are reproducible.

### 2. Immutable Content-Addressed Snapshots

Every state transition produces a cryptographically hashed snapshot (`ContextSnapshot`). Snapshots compute a deterministic SHA-256 digest over the entire canonical JSON state payload. Two sessions with identical perception sequences will always produce identical state hashes, ensuring verifiable audit trails.

### 3. Comprehensive Provenance

No data exists in Runtime Context without provenance. Every fact, observation, and state field is accompanied by:
- `source`: The producing subsystem (`browser`, `desktop`, `filesystem`, `planner`, `system`).
- `timestamp`: Millisecond Unix timestamp of capture.
- `confidence`: Floating-point scalar from 0.0 to 1.0 indicating sensor or extractor reliability.
- `correlationId`: Identifier linking the state mutation to an execution run, task, or approval gate.

### 4. Transactional Integrity and Rollback

Context updates support transactional execution. If an exception occurs midway through a multi-field update or graph mutation, the draft state is discarded and the context rolls back to the previous stable version without state corruption.

### 5. Unified Facade Access

Consumers interact exclusively through `RuntimeContextFacade`. Internal data structures (inverted index structures, graph adjacency lists, and cache eviction queues) remain private to the package.

---

## Where It Fits

```text
                     ┌──────────────────────┐
                     │     User Prompt      │
                     └──────────┬───────────┘
                                │
                                ▼
                     ┌──────────────────────┐
                     │  @usepilot/backend   │
                     │  (Orchestrator)      │
                     └──────────┬───────────┘
                                │
             ┌──────────────────┴──────────────────┐
             ▼                                     ▼
  ┌──────────────────────┐              ┌──────────────────────┐
  │@usepilot/planner-core│              │@usepilot/execution-  │
  │   (Cognitive DAG)    │              │       core           │
  └──────────┬───────────┘              └──────────┬───────────┘
             │                                     │
             │ Read Queries                        │ Emit Observations
             ▼                                     ▼
  ┌────────────────────────────────────────────────────────────┐
  │               @usepilot/runtime-context                    │
  │                                                            │
  │  ┌──────────────────────────────────────────────────────┐  │
  │  │                 RuntimeContextFacade                 │  │
  │  └──────────────────────────┬───────────────────────────┘  │
  │                             │                              │
  │   ┌──────────────┬──────────┴───┬──────────────┬────────┐  │
  │   ▼              ▼              ▼              ▼        ▼  │
  │ StateDomain  KnowledgeDomain QueryDomain  EntityDomain ... │
  └────────────────────────────────────────────────────────────┘
```

- `@usepilot/planner-core` reads from Runtime Context via `QueryDomain` to evaluate preconditions, detect installed browsers, discover available files, and assess environmental readiness before generating an `ExecutionBlueprint`.
- `@usepilot/execution-core` writes to Runtime Context via `ObservationsDomain`, `StateDomain`, and `KnowledgeDomain` as adapters navigate web pages, download files, execute shell commands, and verify task success.
- `apps/desktop` reads diagnostic reports and entity graphs via `QueryDomain` and `ReplayDomain` to render the real-time execution inspector and visual timeline.

---

## Architecture

The subsystem is organized into domain namespaces exposed via the `RuntimeContextFacade`:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          RuntimeContextFacade                          │
├──────────────┬──────────────┬──────────────┬──────────────┬────────────┤
│    query     │ observations │  knowledge   │   entities   │  storage   │
├──────────────┼──────────────┼──────────────┼──────────────┼────────────┤
│ RuntimeQuery │ Observation  │  Knowledge   │ RuntimeEntity│ StorageTier│
│    Engine    │    Engine    │    Store     │    Graph     │  Manager   │
│              │              │              │              │            │
│  - Compile   │  - Emit      │  - Domains   │  - Nodes     │  - Hot     │
│  - Search    │  - Filter    │  - Forms     │  - Edges     │  - Warm    │
│  - Index     │  - Purge     │  - Cache     │  - Traverse  │  - Cold    │
│  - Memory    │  - Subscribe │  - TTL       │  - Query     │  - Prune   │
└──────────────┴──────────────┴──────────────┴──────────────┴────────────┘
```

### Subsystem Components

| Component | Class / Module | Core Responsibility |
|---|---|---|
| **Core State** | `RuntimeContext` | In-memory session state, atomic draft mutations, snapshot hashing. |
| **Facade Gateway** | `RuntimeContextFacade` | Unified public API grouping domain controllers and atomic transactions. |
| **Factory** | `createRuntimeContextFacade` | Dependency injection container providing isolated subsystem instances. |
| **Observation Engine** | `ObservationEngine` | Ring buffer for temporal perceptual frames, category filtering, listener dispatch. |
| **Knowledge Store** | `KnowledgeStore` | Tiered memory store supporting temporary cache entries, persistent facts, and documents. |
| **Browser Graph** | `BrowserKnowledgeGraph` | Directed web graph tracking visited domains, page URLs, form inputs, and staleness. |
| **Entity Graph** | `RuntimeEntityGraph` | Bidirectional adjacency graph modeling cross-domain entities and relationships. |
| **Runtime Index** | `RuntimeIndexEngine` | Inverted word-token index supporting prefix search and entity filtering. |
| **Execution Memory** | `ExecutionMemoryStore` | Historical task execution outcomes, learned recovery patterns, and durations. |
| **Query Engine** | `RuntimeQueryEngine` | Multi-domain query aggregator compiling unified perception bundles. |
| **Storage Tiering** | `RuntimeStorageTierManager` | Memory distribution metrics, cache pruning, and storage lifecycle policy enforcement. |
| **Invalidation Engine** | `ContextInvalidationEngine` | Cascade invalidation when domain roots, files, or sessions are mutated. |
| **Diff Engine** | `ContextDiffEngine` | Field-by-field JSON diff generation across historical context versions. |
| **Observation Replay** | `ObservationReplayEngine` | Step-by-step cursor stepping across historical observation buffers. |
| **Health Monitor** | `RuntimeContextHealthMonitor` | Subsystem telemetry, buffer utilization, and operational diagnostics. |

---

## Core Concepts

### Context Provenance

Every data point in the subsystem carries metadata tracing its origin:

```typescript
export interface ContextProvenance {
  source: 'browser' | 'desktop' | 'filesystem' | 'planner' | 'system'
  timestamp: number
  confidence: number // Scalar 0.0 to 1.0
  correlationId?: string | undefined
  adapter?: string | undefined
  metadata?: Record<string, unknown> | undefined
}
```

### Runtime Context State

Hot state is structured into three environmental domains:

```typescript
export interface RuntimeContextState {
  sessionId: string
  version: number
  contextSchemaVersion: number
  browser: {
    currentUrl?: string | undefined
    pageTitle?: string | undefined
    activeDomain?: string | undefined
    authenticatedDomains: string[]
    tabCount: number
    lastUpdated: number
  }
  desktop: {
    activeWindowTitle?: string | undefined
    focusedProcessId?: number | undefined
    clipboardPreview?: string | undefined
    lastUpdated: number
  }
  filesystem: {
    currentWorkingDirectory: string
    activeDownloads: string[]
    recentPaths: string[]
    lastUpdated: number
  }
  customEntries: Record<string, { value: unknown; provenance: ContextProvenance }>
  createdAt: number
  updatedAt: number
}
```

### Observations vs. Execution Events

A critical distinction exists between **Observations** and **Journal Events**:

- **Execution Journal Events** (`@usepilot/execution-types`): Operational records of task dispatch, retry attempts, approvals, and error codes.
- **Runtime Observations** (`@usepilot/runtime-context`): Environmental perceptions captured at a specific moment in time (DOM layout, OCR text boxes, file existence, active process titles).

```typescript
export interface BaseObservation {
  id: string
  type: 'browser' | 'filesystem' | 'desktop' | 'vision' | 'verification'
  provenance: ContextProvenance
  timestamp: number
}
```

### Three-Tier Storage Architecture

```text
┌───────────────────────────────────────────────────────────────┐
│                      Hot Tier (In-Memory)                     │
│  - Active RuntimeContextState                                 │
│  - Live Observation Ring Buffer                               │
│  - Current Window & DOM Nodes                                 │
├───────────────────────────────────────────────────────────────┤
│                     Warm Tier (Cache & Graph)                 │
│  - Browser Knowledge Graph (URLs, Forms)                      │
│  - Runtime Entity Graph (Relational Nodes & Edges)            │
│  - Inverted Semantic Search Index                             │
│  - Document & OCR Text Extracts                               │
├───────────────────────────────────────────────────────────────┤
│                     Cold Tier (Historical)                    │
│  - Context Snapshots (SHA-256 Checksummed)                    │
│  - Execution Memory & Performance Records                     │
│  - Observation Replay History                                 │
└───────────────────────────────────────────────────────────────┘
```

---

## Data Flow

```text
Adapter Activity (e.g. Browser Page Load)
                    │
                    ▼
     1. Emit Typed Observation
        facade.observations.emit({
          type: 'browser',
          url: 'https://app.example.com',
          provenance: { source: 'browser', confidence: 1.0 }
        })
                    │
                    ├─────────────────────────────────────────┐
                    ▼                                         ▼
     2. Mutate Hot State                       3. Update Knowledge & Entity Graph
        facade.state.mutate(draft => {            facade.knowledge.recordPageVisit(domain, url)
          draft.browser.currentUrl = url          facade.entities.createEntity({
          draft.browser.pageTitle = title           type: 'Website',
        })                                          name: 'Example App'
                    │                             })
                    ▼                                         │
     4. Generate ContextSnapshot                              │
        - Version incremented (v1 -> v2)                      │
        - Deterministic SHA-256 computed                      │
                    │                                         │
                    ▼                                         ▼
     5. Notify Observers & Replay Engines      6. Index for Retrieval
        - MemoryContextStore updated              - Words added to RuntimeIndexEngine
        - Replay buffer appends frame             - Searchable by QueryEngine
```

---

## Public API

### Primary Entry Point: Factory

```typescript
import { createRuntimeContextFacade } from '@usepilot/runtime-context'

// Create a standalone facade with default internal stores
const context = createRuntimeContextFacade({
  maxStoredObservations: 5000,
  maxCacheEntries: 1000,
})
```

### Domain Interfaces

#### 1. `facade.query`

Exposes read-only compilation and multi-domain search across all stores:

```typescript
// Query full perception bundle for planning
const bundle = await context.query.compile({
  includeObservations: true,
  includeKnowledge: true,
  includeEntities: true,
  maxObservations: 50,
})

// Search indexed documents and OCR extractions
const searchResults = await context.query.search({
  term: 'invoice',
  entityTypes: ['document', 'file'],
  limit: 10,
})

// Check subsystem health
const healthReport = await context.query.health()
```

#### 2. `facade.state`

Manages hot environmental state and transactional mutations:

```typescript
// Get current snapshot state
const state = context.state.getState('session-default')

// Atomic mutation with automatic rollback
const snapshot = await context.state.mutate('session-default', (draft) => {
  draft.filesystem.currentWorkingDirectory = '/workspace/project'
  draft.filesystem.recentPaths.push('/workspace/project/README.md')
})

console.log(snapshot.version, snapshot.checksum)
```

#### 3. `facade.observations`

Ingests, filters, and purges environmental observation frames:

```typescript
import { createProvenance } from '@usepilot/runtime-context'

context.observations.emit({
  type: 'browser',
  url: 'https://console.cloud.google.com',
  title: 'Google Cloud Console',
  provenance: createProvenance('browser', { confidence: 0.98 }),
})

// Filter observations by category
const browserFrames = context.observations.list({ type: 'browser', limit: 20 })

// Subscribe to real-time observations
const unsubscribe = context.observations.subscribe((observation) => {
  console.log('Observed:', observation.type, observation.timestamp)
})
```

#### 4. `facade.knowledge`

Stores website topologies, form definitions, and cached assets:

```typescript
// Record a visited webpage node
context.knowledge.recordPage('amazon.in', {
  url: 'https://amazon.in/gp/css/order-history',
  title: 'Your Orders',
  formFields: [
    { selector: '#orderFilter', fieldType: 'select', name: 'timeFilter' },
  ],
})

// Retrieve cached domain facts
const domainGraph = context.knowledge.getDomain('amazon.in')
```

#### 5. `facade.entities`

Manages relational property graph entities and edge traversals:

```typescript
// Create graph entities
context.entities.createEntity({
  id: 'site-amazon',
  type: 'Website',
  name: 'Amazon India',
  attributes: { domain: 'amazon.in' },
})

context.entities.createEntity({
  id: 'doc-invoice-102',
  type: 'Document',
  name: 'GST Tax Invoice',
  attributes: { amount: 25000, currency: 'INR' },
})

// Link entities with typed relationship
context.entities.createRelationship({
  id: 'rel-1',
  sourceId: 'site-amazon',
  targetId: 'doc-invoice-102',
  type: 'generated',
})

// Query entity neighborhood (1-hop or 2-hop traversal)
const related = context.entities.getNeighbors('site-amazon', { direction: 'outgoing' })
```

#### 6. `facade.transaction`

Multi-subsystem atomic transaction:

```typescript
await context.transaction(async (tx) => {
  // Any exception here rolls back state, knowledge, and entities together
  await tx.state.mutate('session-1', (draft) => {
    draft.browser.activeDomain = 'github.com'
  })

  tx.entities.createEntity({
    id: 'ent-gh',
    type: 'Website',
    name: 'GitHub',
    attributes: {},
  })
})
```

---

## Design Tradeoffs

### 1. Bidirectional Property Graph vs. Tree Hierarchy
Computer-use automation involves entities that naturally form arbitrary networks rather than strict hierarchies. A single `Website` generates multiple `Document` entities; a downloaded `File` is produced by one `Task` and verified by another `Task`. Storing this in a hierarchical tree forces artificial duplication of nodes or broken referential links. An in-memory bidirectional property graph (`RuntimeEntityGraph`) allows O(1) adjacency lookup in either direction (`incoming` and `outgoing`) and cleanly models cyclic references without data redundancy.

### 2. Immutable Checksummed Snapshots vs. Mutable History
Rather than mutating a shared state tree in-place and attempting to reconstruct past states through inverse delta patches, every transaction in `RuntimeContext` yields an immutable `ContextSnapshot` bearing a SHA-256 content digest. This design:
- Enables O(1) equality checks across execution steps (comparing 32-byte hashes instead of deep object trees).
- Provides tamper-evident forensic audit trails for compliance.
- Allows the UI and background workers to hold stable read snapshots without locking.

### 3. Separation of Observations from Execution Journal
The subsystem maintains a strict firewall between **Observations** (`ObservationEngine`) and **Journal Events** (`ExecutionJournal`):
- Observations capture *what the system perceived* (DOM trees, active window titles, file checksums).
- Journal events capture *what the agent decided to do* (dispatched task, retried locator, requested approval).
Conflating these two creates bloated streams, makes replaying perceptual state dependent on execution side effects, and prevents planners from reasoning about environmental reality independently of task success.

---

## Invariants and Guarantees

1. **Monotonic Revisions**: `version` increments strictly by 1 upon every committed transaction. Version numbers never skip, regress, or reuse values within a session.
2. **Deterministic Checksums**: Canonical JSON serialization sorts all dictionary keys alphabetically prior to hashing. Two independent sessions that arrive at identical states will always produce identical SHA-256 digests.
3. **Referential Adjacency Integrity**: Deleting an entity from `RuntimeEntityGraph` synchronously removes all incoming and outgoing relationship edges. Dangling relationship pointers cannot exist.
4. **Deep-Clone Boundary**: `getState()` returns a deep clone of the in-memory state. Mutating the returned object has zero effect on the internal store.
5. **Hot State Protection**: Budget eviction sweeps prune warm cache entries and cold replay buffers, but never evict the active `Hot` session state.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Recovery Behavior | What Recovery Does NOT Attempt |
|---|---|---|---|
| **Mutation Exception** | `try / catch` inside `mutate()` | Discards the draft object immediately; restores prior stable snapshot with zero state leakage. | Does not attempt partial retries or speculative commits. |
| **Memory Budget Pressure** | `RuntimeContextBudgets` ceiling check | Sweeps warm cache (`cleanExpired()`) and shifts oldest observation ring-buffer frames. | Does not evict active session data or unpersisted transactions. |
| **Stale Domain Route** | `isStale()` confidence drop (< 0.7) | Flags domain as degraded in health reports; prompts planner to trigger exploratory navigation. | Does not automatically mutate or delete existing page nodes. |
| **Corrupted State Restore** | SHA-256 digest validation | Throws explicit integrity mismatch error during snapshot ingestion. | Does not proceed with corrupted or untrusted snapshot states. |

---

## Things To Avoid

- **Do NOT mutate objects returned from `getState()` directly.** Any mutation made directly to the return value of `getState()` is lost. Always execute updates inside `facade.state.mutate(draft => ...)`.
- **Do NOT bypass `RuntimeContextFacade`.** Do not instantiate or access private subsystem classes (`RuntimeIndexEngine`, `KnowledgeStore`, `RuntimeEntityGraph`) directly in application code. The facade coordinates cross-domain transactions and cache consistency.
- **Do NOT emit operational journal events into the `ObservationEngine`.** Do not pass `task_started` or `approval_granted` into `observations.emit()`. Observations represent environmental state snapshots, not workflow actions.
- **Do NOT store large binary files directly in context state.** Binary assets (screenshots, downloaded PDFs, video traces) must be persisted in the Artifact Store and referenced in context state strictly via their canonical `artifact://` URIs.
- **Do NOT cache browser or operating system state in external singleton variables.** All external adapters must write perceptions into `RuntimeContext` so that state remains replayable, inspectable, and subject to transactional rollback.

---

## Error Handling & Recovery

1. **State Mutation Exceptions**: When a function passed to `context.mutate(draft => ...)` throws an error, the draft object is discarded immediately. The internal state remains locked at the prior stable version with no partial application.
2. **Adjacency Integrity**: The `RuntimeEntityGraph` verifies that both `sourceId` and `targetId` exist prior to creating relationships. Removing an entity automatically prunes all connected outgoing and incoming adjacency edges to prevent orphan pointers.
3. **Cache Expiration**: Items in `KnowledgeStore` with retention policy `temporary` expire deterministically based on their `ttlSeconds` via `isExpired()`. Eviction sweeps run during read queries and storage tiering passes.
4. **Budget Enforcement**: In long-running agent workflows, `RuntimeContextBudgets` prevent unbounded memory growth by rejecting or pruning excess entity nodes, replay frames, and cached OCR records when configured limits are reached.

---

## Concurrency & Determinism

- **Single-Threaded Event Loop**: The subsystem is written for Node.js / Bun single-threaded execution, eliminating thread-level race conditions.
- **Deep-Clone Isolation**: `getState()` returns a deep clone of the internal state. External mutations to returned objects cannot alter internal runtime context records.
- **Topological Invariant**: The `BrowserKnowledgeGraph` uses strict domain keying (`domain.toLowerCase()`) to ensure case-insensitive URL domain deduplication.
- **Deterministic Hashing**: Snapshots use Node's `createHash('sha256')` over sorted JSON serialization keys, guaranteeing that identical states always yield identical hashes regardless of object key insertion order.

---

## Data Ownership and Lifecycle

| Data Structure | Primary Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Hot Context State** | `ContextStore` | `StateDomain` (via Facade) | Planner, Desktop UI | Active session | Memory-only; exported to snapshot on state change |
| **Entity Graph** | `RuntimeEntityGraph` | `EntityDomain` (via Facade) | Planner, Diagnostics | Active execution run | In-memory during run; serializable via `export()` |
| **Observations Ring Buffer** | `ObservationEngine` | Capability Adapters | Observers, Replay Engine | Rolling 2,000 records | Volatile; evicted via FIFO shift |
| **Knowledge Store** | `KnowledgeStore` | Adapters, Extractors | Planner, Adapters | Mixed (TTL cache vs Pinned) | Exported to disk alongside task runs |
| **Runtime Index** | `RuntimeIndexEngine` | Extractors, Indexers | Planner, Diagnostics | Execution session | In-memory inverted index |

---

## Failure Assumptions

1. **Adapter Ephemerality**: Capability adapters may crash or terminate unexpectedly. Runtime Context assumes adapters are ephemeral and guarantees that state recorded prior to an adapter crash remains uncorrupted.
2. **Memory Ceilings**: In long-running autonomous workflows, memory is finite. The subsystem assumes environments enforce memory budgets and implements FIFO eviction across observations and LRU pruning across unpinned cache entries.
3. **No External Shared Memory**: Runtime Context assumes execution runs in an isolated process without shared memory threads. Concurrency is handled strictly through the asynchronous JavaScript event loop.

---

## Common Extension Points

- **Adding a New Observation Type**: Extend `ObservationType` union in `src/types.ts`, implement the typed interface extending `BaseObservation`, and register any domain-specific context reflection in `ObservationEngine.emit()`.
- **Adding a New Entity Graph Node/Edge Type**: Extend `EntityType` and `RelationshipType` in `src/graph/types.ts`. All indexing, edge validation, and traversal logic automatically inherit the new types.
- **Adding a New Knowledge Category**: Extend `KnowledgeCategory` in `src/knowledge/types.ts`. Compound keying (`${category}:${key}`) and TTL sweeps automatically accommodate the new category.

---

## Performance Characteristics

- **State Snapshot Computation**: ~0.2ms for typical context states (~50KB payload).
- **Entity Traversal**: O(1) adjacency lookup via `Map<string, Set<string>>` for incoming and outgoing relationships.
- **Inverted Index Query**: O(k) prefix lookups where k is the number of matching tokens, backed by normalized token sets.
- **Memory Footprint**: Designed to remain under 50MB for up to 10,000 observations and 2,000 graph entities.

---

## Testing Strategy

The subsystem maintains comprehensive unit and integration test coverage:

- `core/context.test.ts`: Verifies atomic state mutation, snapshot hashing, and rollback on failure.
- `observations/observation-engine.test.ts`: Tests high-throughput observation ingestion, filtering, and subscription teardown.
- `knowledge/knowledge-store.test.ts`: Validates cache expiration, domain graph updates, and document storage.
- `index/runtime-index.test.ts`: Evaluates keyword tokenization, prefix search accuracy, and entity filtering.
- `graph/entity-graph.test.ts`: Tests bidirectional edge traversal, cycle tolerance, and cascading deletion.
- `retrieval/query-engine.test.ts`: Ensures unified context compilation respects filtering parameters and latency constraints.
- `facade/facade.test.ts`: Exercises end-to-end multi-domain transactions and isolation boundaries.

Run the test suite:

```bash
pnpm --filter @usepilot/runtime-context test
```

---

## Related Documentation

- [ADR-037: Runtime Context Layer Architecture](../adr/ADR-037-runtime-context-layer.md)
- [ADR-043: Runtime Entity Graph Specification](../adr/ADR-043-runtime-entity-graph.md)
- [Browser Knowledge Graph Documentation](../browser-graph/README.md)
- [Knowledge Store Architecture](../knowledge-store/README.md)
- [Observations Subsystem](../observations/README.md)
- [Runtime Index Specification](../runtime-index/README.md)
