# usePilot Planner — Architectural Overview

## 1. Role in usePilot

Phase 2 introduces the **Intelligence Layer** of usePilot. Its responsibility is to reliably transform ambiguous natural language requests into deterministic, validated, and optimized **ExecutionBlueprints**.

The planner is **pure intelligence**:
- No browser automation
- No desktop control
- No Playwright scripts
- Zero execution logic

Phase 2 produces blueprints; Phase 3 executes them.

---

## 2. Pipeline Stages

```
Natural Language Input
        ↓
1.  RequestClassifier         (Deterministic heuristics + LLM fallback)
        ↓ (when planning)
2.  Normalizer                (Whitespace, relative dates, entity tagging)
        ↓
3.  GoalExtractor             (LLM: canonical text → structured Goal)
        ↓
4.  GoalValidator             (Completeness check, length & clarity)
        ↓
5.  IntentAnalyzer            (LLM: classifies type, operational risk, complexity)
        ↓
6.  TaskGenerator             (LLM: atomic tasks with tools, pre/postconditions)
        ↓
7.  ApprovalEngine            (Assigns automatic, optional, mandatory, forbidden)
        ↓
8.  GraphBuilder              (Pure algorithm: Kahn's DAG, parallel groups, critical path)
        ↓
9.  Three-Layer Validation    (SchemaValidator → SemanticValidator → ExecutionValidator)
        ↓
10. PlanOptimizer             (Merge sequential tasks, deduplicate, simplify)
        ↓
11. PlanSerializer            (Computes SHA-256 fingerprint, stamps version)
        ↓
12. Persistence & Streaming   (persists in SQLite, streams WS events to UI)
```

---

## 3. Guarantees

1. **Deterministic Contracts**: The output is an `ExecutionBlueprint` where every task explicitly declares its tool, preconditions, postconditions, and approval requirements.
2. **Environment Awareness**: The planner receives full `PlannerContext` (OS platform, installed tools, user settings, recent plans) so tasks are tailored to the machine.
3. **Auditability**: Every planning run is recorded in `planner_runs` with start/end timestamps, tokens consumed, and error codes on failure.
