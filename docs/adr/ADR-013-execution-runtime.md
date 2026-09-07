# ADR-013: Deterministic Execution Runtime

## Context
Autonomous agents often intertwine execution and dynamic LLM reasoning at every step, creating nondeterministic behavior and high latency.

## Decision
Build `ExecutionRunner` as a deterministic state machine consuming immutable `ExecutionBlueprint`s. The LLM is completely excluded from the inner execution loop. Tasks are scheduled in topological batches directly from the blueprint DAG.

## Consequences
- Predictable execution timelines and reproducible audit traces.
- Clear separation between cognitive planning (Phase 2) and deterministic execution substrate (Phase 3).
- Fast, local execution without recurring API round-trips.
