# ApprovalPolicy & Safety Enforcement

## Purpose

Instead of a simple boolean (`approvalRequired: true/false`), usePilot implements a multi-tier governance model:

```typescript
export type ApprovalPolicy = 'automatic' | 'optional' | 'mandatory' | 'forbidden'
```

## Policy Levels

| Policy | Behavior | Triggers |
|---|---|---|
| `automatic` | Executes without user interruption | Navigation, data extraction, read-only operations |
| `optional` | User may review before start | Renaming files, minor non-destructive updates |
| `mandatory` | Execution pauses until explicit user confirmation | Financial transactions, deletion, sending messages, shell commands |
| `forbidden` | Invalidation of entire plan | System directory modification, disk format, malicious commands |

The `ApprovalEngine` evaluates tasks and attaches human-readable reasons for auditability.
