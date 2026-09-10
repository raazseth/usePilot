# Three-Layer Validation Suite

## Purpose

To prevent malformed, incoherent, or dangerous blueprints from ever reaching execution, validation is divided into three sequential layers. Later layers only execute if earlier layers pass without error.

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
│    capability availability checks, unreachable node checks   │
└─────────────────────────────────────────────────────────────┘
```

## Validation Contracts

```typescript
export type ValidationLayer = 'schema' | 'semantic' | 'execution'
export type ValidationSeverity = 'error' | 'warning' | 'suggestion'

export interface ValidationIssue {
  layer: ValidationLayer
  severity: ValidationSeverity
  code: string
  message: string
  target?: string | undefined
}

export interface LayerValidationResult {
  layer: ValidationLayer
  passed: boolean
  issues: ValidationIssue[]
  durationMs: number
}

export interface ValidationResult {
  valid: boolean
  schema: LayerValidationResult
  semantic: LayerValidationResult
  execution: LayerValidationResult
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  suggestions: ValidationIssue[]
  totalDurationMs: number
}
```

## Safety Enforcement

If any task is marked with `approvalPolicy: 'forbidden'`, the `ExecutionValidator` emits an error issue, marking the entire blueprint as invalid and preventing downstream execution.

