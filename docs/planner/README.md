# Planner Subsystem Documentation

This directory contains the complete technical specification for the usePilot Planner Subsystem (`@usepilot/planner-core` and `@usepilot/planner-types`).

---

## 1. What is this?

The Planner is a 14-stage cognitive planning engine that translates natural language user objectives into deterministic, DAG-ordered, cryptographically signed `ExecutionBlueprint`s.

The Planner handles intent classification, input normalization, goal decomposition, atomic task generation, safety policy evaluation, three-layer validation (schema, semantic, execution), DAG construction via Kahn's algorithm, plan optimization, and blueprint serialization.

---

## 2. Why does it exist?

Autonomous LLM execution loops (where the model is prompted in a loop to "call the next tool") are non-deterministic, difficult to audit, susceptible to infinite loops, and costly in token usage.

usePilot separates planning from execution:
- **The Planner reasons**: It interacts with AI models, analyzes user objectives, performs safety checks, and produces an immutable blueprint.
- **The Runner executes**: The execution engine carries out the blueprint deterministically without LLM intervention.

This architecture ensures that plans can be inspected, verified, approved by users, and securely sealed with SHA-256 fingerprints before any tool or system resource is touched.

---

## 3. Documents in this Directory

| Document | Purpose |
|---|---|
| [Planner Overview](planner-overview.md) | 14-stage planning pipeline, component interactions, and state machines |
| [Request Classifier](request-classifier.md) | Two-pass intent router (fast heuristic scoring + provider LLM fallback) |
| [Input Normalizer](normalizer.md) | Text cleaning, entity extraction, and constraint normalization |
| [Goal Model](goal-model.md) | Canonical goal extraction, schema representation, and validation |
| [Task Model](task-model.md) | Atomic task structures, parameters, and canonical `TaskCapability` types |
| [Approval Policy](approval-policy.md) | 4-tier safety evaluation (`automatic`, `optional`, `mandatory`, `forbidden`) |
| [Graph Model](graph-model.md) | Kahn's algorithm DAG builder, topological sorting, and critical path analysis |
| [Validation Layers](validation-layers.md) | Structural Zod validation, semantic validation, and execution feasibility checks |
| [Plan Optimizer](optimizer.md) | Deduplication, redundant task pruning, and sequential task batching |
| [Planner Context](planner-context.md) | Host platform info, available capabilities, and historical context aggregation |

---

## 4. Key Subsystems & Collaborators

- [Execution Subsystem](../execution/README.md): Consumes the generated `ExecutionBlueprint` and coordinates adapters.
- [Runtime Context](../runtime-context/README.md): Provides domain knowledge, active browser state, and entities to inform plan generation.
- [Public API Reference](../architecture/public-api-reference.md): Lists all exported Planner classes and functions.
- Relevant ADRs:
  - [ADR-007: Request Classifier](../adr/ADR-007-request-classifier.md)
  - [ADR-008: Input Normalizer](../adr/ADR-008-normalizer.md)
  - [ADR-009: Three-Layer Validation](../adr/ADR-009-three-layer-validation.md)
  - [ADR-010: Task Graph DAG](../adr/ADR-010-task-graph-dag.md)
  - [ADR-011: Approval Policy](../adr/ADR-011-approval-policy.md)
  - [ADR-012: Plan Optimizer](../adr/ADR-012-plan-optimizer.md)

---

## 5. Where should I go next?

- To explore the complete 14-stage planning lifecycle, read [Planner Overview](planner-overview.md).
- To examine how tasks and capabilities are modeled, read [Task Model](task-model.md).
- To understand how safety and human-in-the-loop approvals are classified, read [Approval Policy](approval-policy.md).
- To see how the blueprint is executed, navigate to [Execution Overview](../execution/execution-overview.md).
- To return to the master index, view [Documentation Index](../README.md).
