# Task Model

## The Atomicity Rule

Each `Task` represents a single atomic executable unit of work:
**One Task = One Operation = One Tool.**

Phase 3 never needs to infer tools or break down composite steps.

## Schema

```typescript
export interface Task {
  id: string
  title: string
  description: string
  category: TaskCategory
  requiredTool: TaskTool
  toolConfig?: Record<string, unknown>
  preconditions: string[]
  postconditions: string[]
  successConditions: string[]
  failureConditions: string[]
  dependsOn: string[]
  approvalPolicy: ApprovalPolicy
  approvalReason?: string
  complexity: Complexity
  retryPolicy: RetryPolicy
  failureStrategy: FailureStrategy
  confidence: number
}
```

## Tools

- `browser`: Playwright automation
- `filesystem`: File I/O, directory organization
- `email`: SMTP/IMAP/Client interaction
- `terminal`: Shell command execution
- `clipboard`: System clipboard read/write
- `api`: HTTP/REST operations
- `none`: Pure data transformation
