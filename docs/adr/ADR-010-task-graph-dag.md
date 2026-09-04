# ADR-010: Explicit Directed Acyclic Graph (DAG) Model

## Context
Storing dependencies as plain string arrays on task objects obscures graph-level properties, making cycle detection, critical path calculation, and parallel execution sequencing difficult to reason about and visualize.

## Decision
Introduce an explicit `TaskGraph` with `DAGNode[]`, `DAGEdge[]`, `parallelGroups`, and `criticalPath`. `GraphBuilder` converts the task list into this structure using Kahn's algorithm for topological sorting.

## Consequences
- Guarantees acyclicity through compile-time and runtime validation.
- Identifies parallel tasks upfront for concurrent execution in Phase 3.
- Ready for graph-based visualization in future UI releases with zero schema changes.
