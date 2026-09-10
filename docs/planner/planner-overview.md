# usePilot Planner — Architectural Overview

## 1. Role in usePilot

The **Intelligence Layer** of usePilot is responsible for transforming natural language requests into deterministic, validated, and optimized **ExecutionBlueprints**.

The planner is **pure intelligence**:
- No browser automation
- No desktop control
- No direct OS side effects
- Zero execution logic

The planner produces blueprints specifying abstract capabilities; the execution engine negotiates adapters and executes them.

---

## 2. Pipeline Stages

The planning pipeline executes sequentially across 14 deterministic stages:

```text
Natural Language Input
        │
1.  RequestClassifier         (Deterministic heuristics + provider fallback)
        │ (when classified as 'planning')
2.  Normalizer                (Whitespace cleaning, relative dates, entity tagging)
        │
3.  GoalExtractor             (Extracts canonical Goal from normalized text)
        │
4.  GoalValidator             (Validates clarity, completeness, and feasibility)
        │
5.  MissingInfoDetector       (Detects missing parameters requiring clarification)
        │
6.  IntentAnalyzer            (Analyzes domain, operational risk, and complexity)
        │
7.  TaskGenerator             (Generates atomic tasks with required capabilities)
        │
8.  ApprovalEngine            (Assigns automatic, optional, mandatory, forbidden policies)
        │
9.  GraphBuilder              (Constructs Kahn DAG, parallel groups, critical path)
        │
10. Three-Layer Validation    (SchemaValidator → SemanticValidator → ExecutionValidator)
        │
11. PlanOptimizer             (Deduplication, sequential merging, concurrency discovery)
        │
12. PlanExplainer             (Generates reasoning, assumptions, and tradeoffs)
        │
13. PlanSerializer            (Computes SHA-256 fingerprint, stamps version)
        │
14. Persistence & Streaming   (Persists blueprint in SQLite, streams WS events to UI)
```

---

## 3. Core Guarantees

1. **Deterministic Blueprint Contracts**: The output `ExecutionBlueprint` guarantees every task declares its required capability (`TaskCapability`), preconditions, postconditions, failure strategy, and approval policy.
2. **Host & Context Grounding**: The planner receives full `PlannerContext` (host platform, available capabilities, installed applications, filesystem permissions, user settings) ensuring generated plans are feasible.
3. **Immutability & Integrity**: Blueprints are cryptographically hashed (SHA-256) and cannot be modified once validated and signed.
4. **Clean Handoff**: The execution engine consumes `blueprint.graph` and `blueprint.tasks` directly without recalculating topological ordering or re-evaluating dependencies.

---

## 4. Related Documentation

- [RequestClassifier](request-classifier.md) — Natural language intent classification and routing
- [Normalizer](normalizer.md) — Text cleaning and named entity extraction
- [Goal Model](goal-model.md) — Canonical Goal schema and structured constraints
- [Task Model](task-model.md) — Atomic Task schema and the 17 TaskCapability primitives
- [Approval Policy](approval-policy.md) — Multi-tier governance and human-in-the-loop gates
- [Explicit Task Graph (DAG)](graph-model.md) — Kahn's algorithm DAG, layers, and critical path
- [Three-Layer Validation](validation-layers.md) — Schema, semantic, and execution feasibility checks
- [PlanOptimizer](optimizer.md) — Deterministic graph rewriting, deduplication, and merging
- [PlannerContext](planner-context.md) — Environment aggregation, applications, and permissions
- [Execution Overview](../execution/execution-overview.md) — ExecutionRunner and adapter substrate


