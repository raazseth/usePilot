// Adapter Session Types

import type { TaskCapability } from '@usepilot/planner-types'
import type { ICapabilityAdapter, AdapterContext } from './adapter'
import type { SandboxExecutionResult, SandboxOptions } from './sandbox'

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

export interface SessionManagerOptions {
  defaultScope?: SessionScope | undefined
  idleTimeoutMs?: number | undefined
}

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
