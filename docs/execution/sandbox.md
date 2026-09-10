# Adapter Sandbox

## Overview

The `AdapterSandbox` wraps every adapter execution to enforce safety, execution timeouts, cooperative cancellation, output capture, and panic recovery. The execution engine never invokes `adapter.execute()` directly; all executions pass through `sandbox.execute()`.

## Core Responsibilities

1. **Timeout Enforcement**:
   - Enforces execution limits (default 60,000ms, configurable per task or sandbox options).
   - Aborts an internal `AbortController` linked with `ctx.signal`.
   - Returns an `AdapterResult` with `failureCategory: 'timeout'` if elapsed execution exceeds the deadline.

2. **Cooperative Cancellation**:
   - Links parent cancellation signal with timeout signal.
   - If the parent signal aborts, returns `failureCategory: 'cancellation'`.

3. **Panic Recovery**:
   - Catches synchronous exceptions and unhandled promise rejections originating from adapter code.
   - Sets `panicked: true` and captures error details in `panicError` without crashing the host process.
   - Categorizes uncaught exceptions as `failureCategory: 'adapter_failure'`.

4. **Output Capture**:
   - Captures log messages across `stdout`, `stderr`, and `system` streams.
   - Bundles timestamped log entries into `SandboxExecutionResult.logs`.

5. **Guaranteed Cleanup & Disposal**:
   - Ensures `adapter.cleanup()` and `adapter.dispose()` are always invoked in a `finally` block, preventing leaked child processes, file descriptors, or open browser targets.

## Interface Contract

```typescript
export interface SandboxOptions {
  timeoutMs?: number
  captureOutput?: boolean
  memoryLimitBytes?: number | undefined
}

export interface SandboxLogEntry {
  stream: 'stdout' | 'stderr' | 'system'
  message: string
  timestamp: number
}

export interface SandboxExecutionResult {
  adapterResult: AdapterResult
  logs: SandboxLogEntry[]
  durationMs: number
  panicked: boolean
  panicError?: string | undefined
}
```

