# Task Scheduler

The `TaskScheduler` consumes the pre-computed `blueprint.graph` (DAG) produced by the Phase 2 Planner. The execution engine never recalculates or rebuilds the dependency graph at runtime.

## Batch Scheduling

The scheduler partitions tasks into ordered batches:
- Tasks within the same batch have all dependencies satisfied by earlier batches.
- If a layer in `blueprint.graph` contains multiple independent tasks, `canParallelize` is set to `true`, allowing concurrent dispatch via `Promise.all`.
- If tasks have sequential dependencies (`dependsOn`), they are isolated in separate batches.

## Checkpoint & Recovery Awareness

During recovery, the scheduler receives the set of completed, failed, and skipped tasks from `CheckpointManager`. Completed batches are skipped automatically without re-execution.
