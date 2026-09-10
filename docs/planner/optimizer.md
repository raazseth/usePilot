# PlanOptimizer

## Purpose

The `PlanOptimizer` runs after validation and before serialization. It performs deterministic graph rewriting without invoking language models, eliminating redundant tasks and unlocking concurrency.

## Optimization Result Contract

```typescript
export interface OptimizationResult {
  mergedTasks: Array<{ from: string[]; into: string }>
  removedDuplicates: string[]
  newParallelGroups: string[][]
  simplifications: string[]
  changed: boolean
}
```

## Optimization Passes

1. **Deduplication**: Identifies tasks with identical titles, required capabilities, and tools. Removes duplicates and rewrites downstream dependencies to point to the surviving canonical task.
2. **Sequential Merging**: When two consecutive tasks share identical tools and automatic approval policies, and the second task depends solely on the first without branching, they are merged into a single composite task.
3. **Graph Rebuild & Parallel Discovery**: Recomputes topological layers using Kahn's algorithm, discovering newly unblocked parallel groups and recalculating the critical path.

