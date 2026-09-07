# Adapter Sandbox

## Overview

The `AdapterSandbox` wraps every adapter execution to enforce safety, resource bounds, and panic recovery. The execution engine never invokes `adapter.execute()` directly; all executions pass through `sandbox.execute()`.

## Core Responsibilities

1. **Timeout Enforcement**:
   - Enforces execution limits (default 60 seconds, configurable per task/sandbox).
   - Triggers `AbortController.abort()` to notify cooperatively cancellable adapters.
   - Rejects with `TaskExecutionError` (category: `timeout`) if elapsed execution exceeds the deadline.

2. **Panic Recovery**:
   - Catches synchronous throws and unhandled promise rejections inside the adapter.
   - Sets `panicked: true` and captures error messages into `panicError` without terminating the runtime process.
   - Converts uncaught exceptions into structured `TaskExecutionError` (`category: 'adapter_failure'`).

3. **Output Capture**:
   - Captures log messages across `stdout`, `stderr`, and `system` streams.
   - Bundles timestamped log entries into `SandboxExecutionResult.logs`.

4. **Guaranteed Disposal**:
   - Ensures `adapter.cleanup()` and `adapter.dispose()` are always invoked in a `finally` block, ensuring no leaked file descriptors, child processes, or memory handles survive across tasks.

## Interface

```typescript
export interface SandboxOptions {
  timeoutMs?: number
  captureOutput?: boolean
  memoryLimitBytes?: number | undefined
}

export interface SandboxExecutionResult {
  adapterResult: AdapterResult
  logs: SandboxLogEntry[]
  durationMs: number
  panicked: boolean
  panicError?: string | undefined
}
```
