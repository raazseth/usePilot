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
export interface IAdapterSession {
  readonly id: string
  readonly runId: string
  readonly capability: TaskCapability
  readonly adapter: ICapabilityAdapter
  readonly status: SessionStatus // 'idle' | 'active' | 'recovering' | 'closed' | 'error'
  readonly scope: SessionScope   // 'run' | 'capability' | 'task'
  readonly tasksExecuted: number
  readonly errorCount: number
  readonly recoveryCount: number
  readonly createdAt: number
  readonly lastActiveAt: number

  acquire(): void
  release(): void
  recordError(): void
  recover(): Promise<boolean>
  close(): Promise<void>
}
```

### `ISessionManager`

Coordinates session pooling, acquisition, recycling, and shutdown:

```typescript
export interface ISessionManager {
  getOrCreateSession(capability: TaskCapability): Promise<IAdapterSession>
  releaseSession(session: IAdapterSession): void
  recoverSession(session: IAdapterSession): Promise<boolean>
  closeSession(sessionId: string): Promise<void>
  closeAll(): Promise<void>
  getActiveSessions(): ReadonlyArray<IAdapterSession>
  getSessionStats(): SessionStats
}
```

## Scoping Modes

- **`capability`** (default): One shared session per capability type per run. Subsequent tasks requiring the same capability reuse the existing active session.
- **`run`**: Global shared session where applicable.
- **`task`**: Strict process isolation. A fresh session and adapter are created and closed for each task.

## Error Recovery Protocol

When a task fails or throws an unhandled error:
1. `session.recordError()` increments the error counter.
2. If `errorCount > 0`, `sessionManager.recoverSession(session)` is triggered.
3. The session enters `'recovering'` status, calls `adapter.cleanup()`, and re-initializes the adapter.
4. If recovery succeeds, the session returns to `'idle'` and can be reused.
5. If recovery fails, the session transitions to `'error'` and is closed/removed from the pool, forcing subsequent tasks to acquire a fresh instance.
