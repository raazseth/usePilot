# Goal Model

## Purpose

The `Goal` represents the canonical objective extracted from normalized user input by `GoalExtractor` and verified by `GoalValidator`. It is the formal contract between intent extraction and task generation.

## Schema

```typescript
export interface GoalConstraint {
  id: string
  type: 'budget' | 'temporal' | 'location' | 'format' | 'security' | 'preference' | 'custom'
  key: string
  value: string | number
  unit?: string | undefined
  isHardConstraint: boolean
}

export interface MissingInformationItem {
  id: string
  field: string
  question: string
  reason: string
  importance: 'critical' | 'helpful' | 'optional'
  suggestedValues?: string[] | undefined
}

export interface Goal {
  id: string
  primaryObjective: string
  constraints: GoalConstraint[]
  rawConstraints?: string[] | undefined
  requiredResources: string[]
  expectedOutcome: string
  context?: string | undefined
  missingInformation?: MissingInformationItem[] | undefined
  confidence: number
  normalizedInput: NormalizedInput
  status: 'pending' | 'extracting' | 'validated' | 'failed'
  createdAt: number
}
```

## Validation Rules

- `primaryObjective` must be explicit, actionable, and at least 10 characters.
- `expectedOutcome` must describe measurable completion state (at least 5 characters).
- Vague markers (e.g. "do stuff", "something", "etc") trigger validation failures with automatic re-prompting.
- Confidence must satisfy $\ge 0.1$.
- `constraints` are parsed into structured `GoalConstraint` objects marking hard vs soft limits.

