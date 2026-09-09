# ADR-037: Runtime Context Layer Architecture

## Status
Accepted

## Context
In Phases 1–4, usePilot transitioned from a deterministic execution runtime with stub adapters into a production computer operator capable of operating browsers, filesystems, and desktop interfaces. However, the Planner had no isolated state-awareness layer—adapters and execution internal state risked leaking into planning decisions, or the planner risked querying live automation tools directly.

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
- Zero regressions: Phases 1–4 remain frozen and unchanged.
