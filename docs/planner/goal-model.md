# Goal Model

## Purpose

The `Goal` represents the canonical, extracted objective extracted from user input by `GoalExtractor` and checked by `GoalValidator`.

## Schema

```typescript
export interface Goal {
  id: string
  conversationId: string
  rawText: string
  normalizedText: string
  primaryObjective: string
  constraints: string[]
  requiredResources: string[]
  expectedOutcome: string
  confidence: number
  status: 'pending' | 'extracting' | 'validated' | 'failed'
  createdAt: number
}
```

## Validation Rules

- `primaryObjective` must be non-empty and at least 10 characters.
- `expectedOutcome` must be explicit (at least 5 characters).
- Vague markers (e.g. "do stuff", "something", "etc") trigger validation failures with automatic re-prompting.
- Confidence must be $\ge 0.1$.
