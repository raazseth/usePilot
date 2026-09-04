# ADR-009: Three-Layer Plan Validation

## Context
A single monolithic validator cannot cleanly separate JSON structural flaws, domain semantic gaps, and runtime safety/feasibility violations.

## Decision
Implement a sequential three-layer validation pipeline:
1. `SchemaValidator`: Fast Zod-based structural validation.
2. `SemanticValidator`: Goal coverage, duplicate ID detection, and orphaned task detection.
3. `ExecutionValidator`: DFS cycle detection, tool availability checks, and forbidden task rejection.

Later layers execute only if earlier layers pass.

## Consequences
- Detailed, typed error reporting categorized by layer.
- Invalid schemas fail fast without executing complex graph traversal.
- Safety violations (forbidden actions) reliably prevent plan execution.
