# Task Scheduler

The `TaskScheduler` consumes the pre-computed `blueprint.graph` (DAG) produced by the Planner. The execution runtime never recalculates or rebuilds the dependency graph at runtime.

## Batch Partitioning

```typescript
export interface TaskBatch {
  batchIndex: number
  tasks: Task[]
  canParallelize: boolean
  hasOptional: boolean
}
```

The scheduler partitions tasks into ordered execution batches:
1. **Parallel Groups or Topological Layers**: Uses pre-computed `graph.parallelGroups` when present, or groups nodes by topological `node.layer`.
2. **Approval Isolation**: If any task in a candidate batch requires `approvalPolicy: 'mandatory'`, it is isolated into its own single-task serial batch (`canParallelize: false`). This guarantees human-in-the-loop gates never block unrelated concurrent tasks.
3. **Concurrency Eligibility**: Multi-task batches without mandatory approvals enable concurrent dispatch (`canParallelize: true`), capped at `ExecutionPolicy.maxParallelism`.

## Checkpoint & Recovery Awareness

During recovery from an `ExecutionCheckpoint`, the runner filters completed and skipped tasks. The scheduler provides deterministic execution order, allowing the runner to advance directly to remaining pending tasks without redundant work.

