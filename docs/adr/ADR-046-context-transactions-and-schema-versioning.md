# ADR-046: Context Transactions, Facade Dependency Injection, and Schema Versioning

## Status
Accepted

## Context
1. **Multi-Subsystem Atomicity**: As operations mutate state, add entity nodes, record browser pages, and emit perceptions, a failure mid-flow can leave disparate stores in an inconsistent state.
2. **Facade Dependency Injection**: The Facade required decoupling from hardcoded component instantiations to allow testing with custom mocks, enterprise plugins, and alternative storage backends.
3. **Deterministic Snapshot Evolution**: Without an explicit `contextSchemaVersion` on snapshots and state models, historical replay and long-term persistence would struggle to migrate recorded snapshots across state schema migrations.

## Decision

### 1. Atomic Multi-Subsystem Context Transactions (`facade.transaction`)
We introduce `ContextTransactionRunner` accessed via `facade.transaction(async (tx) => { ... })`:
```ts
await facade.transaction(async (tx) => {
  await tx.state.update(sessionId, (draft) => { ... })
  tx.knowledge.recordPage(domain, page)
  tx.entities.link(src, tgt, type)
  tx.observations.emit(observation)
})
```
- Tracks all operations within the callback.
- If any error is thrown, automatically performs a compensating rollback:
  - Context state is restored to pre-transaction snapshot via `rollbackToSnapshot()`.
  - Added entities and relationships are deleted from `RuntimeEntityGraph`.
  - Emitted observations are purged from `ObservationEngine`.
  - Added knowledge pages are removed from `BrowserKnowledgeGraph`.

### 2. Dependency-Injected Facade (`createRuntimeContextFacade`)
`createRuntimeContextFacade(optionsOrDeps?)` now accepts:
```ts
export interface RuntimeContextDependencies {
  contextStore?: MemoryContextStore
  observationEngine?: ObservationEngine
  knowledgeStore?: KnowledgeStore
  runtimeIndex?: RuntimeIndexEngine
  executionMemory?: ExecutionMemoryStore
  entityGraph?: RuntimeEntityGraph
  replayEngine?: ObservationReplayEngine
}
```
- Any provided dependency is injected directly; any omitted dependency cleanly defaults to a fresh instance.
- Eliminates global singletons and facilitates clean multi-workspace runtime environments.

### 3. Explicit `contextSchemaVersion`
Every snapshot and runtime state payload now includes:
```ts
export const CURRENT_CONTEXT_SCHEMA_VERSION = 1
```
- Tracked on `RuntimeContextState.contextSchemaVersion` and `ContextSnapshot.contextSchemaVersion`.
- Enables deterministic, forward-compatible migrations (`Snapshot V1 -> Snapshot V2`) for long-term historical replay.

## Consequences
- Guaranteed atomicity across multi-domain operations.
- 100% dependency-injected orchestration with zero hidden global singletons.
- Versioned snapshot schemas for deterministic execution replay across schema changes.

