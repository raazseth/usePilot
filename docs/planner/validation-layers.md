# Three-Layer Validation Suite

## Purpose

To prevent malformed, incoherent, or dangerous blueprints from ever reaching execution, validation is divided into three sequential layers. Later layers only execute if earlier layers pass.

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. SchemaValidator (Zod)                                    │
│    Structural correctness, valid enum values, required fields│
└──────────────────────────────┬──────────────────────────────┘
                               │ (passes)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SemanticValidator (Domain Rules)                         │
│    Goal coverage, duplicate task IDs, orphan nodes           │
└──────────────────────────────┬──────────────────────────────┘
                               │ (passes)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ExecutionValidator (Feasibility & Safety)                │
│    DFS cycle detection, forbidden task rejection,           │
│    tool availability checks, unreachable node verification   │
└─────────────────────────────────────────────────────────────┘
```

## Safety Enforcement

If any task is marked with an `approvalPolicy: 'forbidden'`, the `ExecutionValidator` emits an error issue, marking the blueprint as invalid.
