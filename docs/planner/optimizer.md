# PlanOptimizer

## Purpose

The `PlanOptimizer` runs after validation and before serialization. It performs deterministic graph rewriting without invoking the LLM.

## Optimization Passes

1. **Deduplication**: Identifies tasks with identical titles and tools. Removes redundant duplicates and remaps all downstream dependency references to the original task ID.
2. **Sequential Merging**: When two consecutive tasks share the same tool, have automatic approval policies, and the second task depends solely on the first without intermediate branches, they are merged into a single composite step.
3. **Graph Rebuild & Parallel Discovery**: Recomputes topological layers, discovering new parallel execution opportunities.
