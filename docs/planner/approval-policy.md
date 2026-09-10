# Approval Policy & Safety Enforcement

## Purpose

Instead of a binary flag, usePilot implements a multi-tier governance model for task safety:

```typescript
export type ApprovalPolicy = 'automatic' | 'optional' | 'mandatory' | 'forbidden'
```

## Policy Levels

| Policy | Behavior | Triggers | Execution Handling |
|---|---|---|---|
| `automatic` | Executes without user interruption | Navigation, data extraction, read-only filesystem queries | Dispatched immediately in batch |
| `optional` | User may review before start | Renaming files, minor non-destructive updates | Executed automatically unless user requests pause |
| `mandatory` | Execution pauses until explicit user confirmation | Financial transactions, file deletion, sending communications, shell commands | Execution transitions to `waiting_approval`; scheduler isolates task into single-task serial batch |
| `forbidden` | Immediate plan invalidation | System root deletion, disk format, credential harvesting | Rejected during `ExecutionValidator` phase; blueprint cannot run |

## ApprovalEngine & Reason Attachment

The `ApprovalEngine` evaluates tasks based on target capabilities, path targets, and parameters. It stamps each task with its policy and a human-readable `approvalReason`.

## Execution Integration

When the `ExecutionRunner` encounters a task with `approvalPolicy: 'mandatory'`:
1. It commits an `ExecutionCheckpoint` to SQLite with `pendingApprovalTaskId`.
2. It transitions execution status to `waiting_approval`.
3. It emits `onApprovalRequired` via event callbacks to the desktop frontend.
4. Upon user decision (`approved` or `rejected`), it resumes or aborts cleanly.

