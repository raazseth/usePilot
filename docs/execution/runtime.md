# Execution Runtime

The `ExecutionRunner` orchestrates the complete execution lifecycle for an `ExecutionBlueprint`. It controls scheduling, adapter resolution, sandboxing, verification, self-healing, journaling, checkpointing, and terminal reporting.

## Core Responsibilities

- **Topological Scheduling**: Iterates through topological task batches supplied by `TaskScheduler`.
- **Cooperative Lifecycle Control**: Enforces pause, resume, and cancellation signals cleanly across active adapters.
- **Concurrent Dispatch**: Executes independent tasks concurrently within a batch up to `maxParallelism`.
- **Human In The Loop**: Coordinates `ApprovalGate` for tasks requiring mandatory user approval.
- **Capability Negotiation**: Resolves adapters via `PolicyBasedCapabilityNegotiator` and `CapabilityRegistry` based on host OS, adapter health, and `CAPABILITY_DEPENDENCY_GRAPH`.
- **Sandboxed Execution & Retries**: Executes tasks within `AdapterSandbox` and delegates retries to `RetryEngine`.
- **Deterministic Verification**: Validates task postconditions and success criteria via `VerificationEngine`.
- **Self-Healing & Recovery**: Drives `SelfHealingPipeline` and `FailureBundleGenerator` when execution encounters recoverable or unrecoverable faults.
- **Audit & Timeline Indexing**: Records structured events to `ExecutionJournal` and updates `ExecutionTimeline` with zero object duplication.
- **Cryptographic Sealing**: Generates an immutable `ExecutionManifest` verifying runtime parameters and execution integrity.

## Run Options

```typescript
export interface RunOptions {
  platform?: 'windows' | 'macos' | 'linux'
  policy?: ExecutionPolicy
  callbacks?: ExecutionCallbacks
  signal?: AbortSignal
  restoreFromCheckpoint?: string
}
```

## Callbacks & Event Streaming

Callbacks notify external consumers (such as the backend WebSocket server and Tauri frontend) of fine-grained execution events:
- Task events: `onTaskStarted`, `onTaskCompleted`, `onTaskFailed`, `onTaskRetrying`, `onTaskSkipped`
- Approval gates: `onApprovalRequired`, `onApprovalResolved`
- Progress & lifecycle: `onProgress`, `onPaused`, `onResumed`, `onCompleted`, `onFailed`
- Timeline updates: `onTimelineEntry`

