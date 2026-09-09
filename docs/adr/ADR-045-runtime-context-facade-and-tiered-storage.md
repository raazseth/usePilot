# ADR-045: Runtime Context Facade & Hot/Warm/Cold Storage Model

## Status
Accepted

## Context
As the Runtime Context Layer matured, callers faced two architectural risks:
1. **Subsystem Coupling**: Consumers (Planner, Execution, Backend Services) were beginning to import individual internal components (`KnowledgeStore`, `RuntimeIndex`, `EntityGraph`, `BrowserGraph`, `ExecutionMemory`, `ObservationEngine`). This exposed internal state wiring and violated encapsulation.
2. **Homogeneous Memory Model**: Ephemeral UI/browser state, indexed document trees, knowledge topologies, and historical execution logs all sat in a flat memory pool without clear lifetime, persistence, or cleanup policies.

## Decision

### 1. Unified `RuntimeContextFacade` & Factory
We establish `createRuntimeContextFacade(config?)` as the **exclusive public write boundary** for `@usepilot/runtime-context`.
- Avoids global singleton state, enabling isolated testing, multiple concurrent sessions, and multi-workspace support.
- External packages interact *only* with the Facade; internal stores become private implementation details.
- To prevent a monolithic "God Object", APIs are partitioned into focused domain namespaces:
  - `facade.query.*`: Read-only compilation, search, key lookup, health telemetry.
  - `facade.observations.*`: Live state perceptions, event filtering, subscriber streams, buffer purging.
  - `facade.knowledge.*`: Topological browser routes, forms, actions, persistent facts, staleness checks.
  - `facade.entities.*`: Multi-hop entity graph nodes, relationships, and neighbor traversals.
  - `facade.storage.*`: Storage tier introspection, targeted pruning, and deterministic invalidation.
  - `facade.replay.*`: Historical execution and perception state replay.
  - `facade.state.*`: Hot state mutations, snapshots, and snapshot diffing.

### 2. Hot / Warm / Cold Runtime Storage Model
We formalize storage tiering:
- **Hot Tier**:
  - In-memory, high-frequency, volatile state.
  - Current browser state (URL, active domain, tab count), desktop window/clipboard preview, filesystem cwd/downloads, active observation ring buffer.
- **Warm Tier**:
  - Local indexed data & operational topologies.
  - KnowledgeStore persistent items, BrowserKnowledgeGraph routes/forms, RuntimeEntityGraph nodes/edges, RuntimeIndex search documents.
- **Cold Tier**:
  - Durable archival and audit history.
  - Immutable SHA-256 ContextSnapshots, replay journals, execution history records.
- Managed by `RuntimeStorageTierManager` exposing `getMetrics()` and `prune({ tier, olderThanMs, maxEntries })`.

## Consequences
- Single stable public API boundary for the entire Runtime Context Layer.
- Complete isolation between internal stores and external callers.
- Clear operational boundaries for memory management, startup restoration, and automated cleanup.
