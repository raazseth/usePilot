# Execution Runtime

The `ExecutionRunner` orchestrates the execution lifecycle for an `ExecutionBlueprint`.

## Responsibilities

- Iterates through topological batches supplied by `TaskScheduler`.
- Enforces pause, resume, and cancellation signals.
- Dispatches tasks sequentially or concurrently within each batch (`canParallelize`).
- Coordinates `ApprovalGate` for tasks requiring mandatory human sign-off.
- Resolves adapters from `CapabilityRegistry` per task capability and host OS.
- Delegates execution and retries to `RetryEngine`.
- Verifies postconditions with `VerificationEngine`.
- Handles task failure strategies (`abort`, `skip`, `fallback`).
- Emits real-time progress, lifecycle events, and telemetry metrics.
- Constructs the final `ExecutionReport` and `ExecutionResult`.

## Options & Callbacks

```typescript
export interface RunOptions {
  platform?: 'windows' | 'macos' | 'linux'
  callbacks?: ExecutionCallbacks
}
```

Callbacks notify listeners (e.g. backend WebSocket layer) of fine-grained events: `onTaskStarted`, `onTaskCompleted`, `onTaskFailed`, `onTaskRetrying`, `onTaskSkipped`, `onApprovalRequired`, `onApprovalResolved`, `onProgress`, `onPaused`, `onResumed`, `onCompleted`, `onFailed`.
