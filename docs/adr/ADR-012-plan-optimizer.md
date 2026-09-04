# ADR-012: Post-Validation Plan Optimization

## Context
LLMs frequently produce plans with minor redundancies, duplicate subtasks, or unnecessary sequencing between simple actions using the same tool.

## Decision
Run a deterministic `PlanOptimizer` pass after three-layer validation and before blueprint serialization. It performs deduplication of identical task definitions, merges consecutive automatic tasks sharing the same tool, and rebuilds the DAG.

## Consequences
- Produces leaner blueprints with fewer overall round-trips.
- Pure algorithmic execution without LLM overhead.
- All optimizations are explicitly logged in `OptimizationResult` and displayed in the frontend `PlanCard`.
