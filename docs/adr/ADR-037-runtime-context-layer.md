# ADR-037: Runtime Context Layer Architecture

## Status
Accepted

## Context
usePilot operates browsers, filesystems, and desktop interfaces via capability runtimes. However, without an isolated state-awareness layer, adapters and execution internal state risk leaking into planning decisions, or the planner risks querying live automation tools directly.

## Decision
We introduce the **Runtime Context Layer** (`@usepilot/runtime-context`) as the single source of truth between Planner, Execution, and Capability adapters:
```
User → Planner → Runtime Query Engine (Runtime Context) → Execution → Capability Runtime
```
- The planner never queries adapters directly.
- The execution engine never exposes runtime internals.
- Adapters emit typed state observations into Runtime Context.
- State mutation is transactional with optimistic concurrency and rollback support.

## Consequences
- Strict decoupling: Planner operates on state perceptions and knowledge assets without live tool side effects.
- Clean auditability: Every state change generates an immutable, content-addressed snapshot.
- Zero regressions: Core planner, execution substrate, and adapters remain cleanly isolated.

> [!NOTE]
> Direct caller interaction with individual internal sub-engines was subsequently superseded by the unified `RuntimeContextFacade` in [ADR-045](ADR-045-runtime-context-facade-and-tiered-storage.md) and atomic transactional execution in [ADR-046](ADR-046-context-transactions-and-schema-versioning.md).

