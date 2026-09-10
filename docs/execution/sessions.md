# Adapter Sessions

The Adapter Session Model manages the lifecycle and reuse of stateful adapter instances across consecutive tasks within an execution run.

## Why Sessions?

Without sessions, adapters are instantiated, initialized, and destroyed on every individual task. For stateful tasks (e.g. multi-step browser navigation, CLI shell workflows, authenticated API connections), this causes:
1. Redundant process startup and initialization overhead.
2. Loss of runtime state (cookies, active directories, environment variables, authentication tokens).

With sessions, an adapter instance remains active across multiple tasks until the run or scope ends.

## Core Abstractions

### `IAdapterSession`

Represents a managed, active session wrapping an underlying `ICapabilityAdapter`:

```typescript
export type SessionStatus = 'active' | 'idle' | 'closed' | 'panicked'
export type SessionScope = 'run' | 'task' | 'capability'

export interface SessionLifecycle {
  sessionId: string
  runId: string
  capability: TaskCapability
  adapterName: string
  createdAt: number
  lastActiveAt: number
  tasksExecuted: number
  errorCount: number
  status: SessionStatus
}

export interface IAdapterSession {
  readonly id: string
  readonly runId: string
  readonly capability: TaskCapability
  readonly adapter: ICapabilityAdapter
  readonly status: SessionStatus
  readonly lifecycle: SessionLifecycle

  execute(ctx: AdapterContext, options?: SandboxOptions): Promise<SandboxExecutionResult>
  recover(): Promise<boolean>
  close(): Promise<void>
}
```

### `ISessionManager`

Coordinates session pooling, scoping, and clean shutdown:

```typescript
export interface ISessionManager {
  getOrCreateSession(
    runId: string,
    capability: TaskCapability,
    adapter: ICapabilityAdapter,
    scope?: SessionScope
  ): Promise<IAdapterSession>
  getSession(sessionId: string): IAdapterSession | undefined
  listActiveSessions(): IAdapterSession[]
  closeSession(sessionId: string): Promise<void>
  closeAll(): Promise<void>
}
```

## Scoping Modes

- **`capability`** (default): One shared session per capability type per run. Subsequent tasks requiring the same capability reuse the existing active session.
- **`run`**: Global shared session where applicable.
- **`task`**: Strict process isolation. A fresh session and adapter are created and closed for each task.

## Error Recovery Protocol

When an adapter within a session experiences a failure or panic:
1. `session.lifecycle.errorCount` is incremented, and status transitions to `'panicked'` if unhandled.
2. The session executes `session.recover()`, calling `adapter.cleanup()` and re-verifying adapter readiness.
3. If recovery succeeds, the session returns to `'idle'` status for subsequent task executions.
4. If recovery fails, the session is closed and removed from the active session pool, forcing subsequent tasks to acquire a fresh instance.

