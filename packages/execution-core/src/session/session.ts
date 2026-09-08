// AdapterSession — encapsulates adapter lifecycle and state across multiple tasks

import type {
  IAdapterSession,
  ICapabilityAdapter,
  AdapterContext,
  SandboxExecutionResult,
  SandboxOptions,
  SessionLifecycle,
  SessionStatus,
} from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'

import { AdapterSandbox } from '../sandbox'

export class AdapterSession implements IAdapterSession {
  readonly id: string
  readonly runId: string
  readonly capability: TaskCapability
  readonly adapter: ICapabilityAdapter
  private _status: SessionStatus = 'idle'
  private readonly _lifecycle: SessionLifecycle
  private readonly sandbox: AdapterSandbox

  constructor(
    runId: string,
    capability: TaskCapability,
    adapter: ICapabilityAdapter,
    sandbox?: AdapterSandbox,
    sessionId?: string
  ) {
    this.id = sessionId ?? `session_${generateId()}`
    this.runId = runId
    this.capability = capability
    this.adapter = adapter
    this.sandbox = sandbox ?? new AdapterSandbox()

    const now = Date.now()
    this._lifecycle = {
      sessionId: this.id,
      runId,
      capability,
      adapterName: adapter.name,
      createdAt: now,
      lastActiveAt: now,
      tasksExecuted: 0,
      errorCount: 0,
      status: this._status,
    }
  }

  get status(): SessionStatus {
    return this._status
  }

  get lifecycle(): SessionLifecycle {
    return { ...this._lifecycle, status: this._status }
  }

  async execute(ctx: AdapterContext, options?: SandboxOptions): Promise<SandboxExecutionResult> {
    if (this._status === 'closed') {
      throw new Error(`Cannot execute task on closed session ${this.id}`)
    }

    this._status = 'active'
    this._lifecycle.lastActiveAt = Date.now()
    this._lifecycle.tasksExecuted += 1

    try {
      const result = await this.sandbox.execute(this.adapter, ctx, options)

      if (result.panicked) {
        this._status = 'panicked'
        this._lifecycle.errorCount += 1
      } else if (!result.adapterResult.success) {
        this._lifecycle.errorCount += 1
        this._status = 'idle'
      } else {
        this._status = 'idle'
      }

      return result
    } catch (err) {
      this._status = 'panicked'
      this._lifecycle.errorCount += 1
      throw err
    }
  }

  async recover(): Promise<boolean> {
    if (this._status === 'closed') return false

    try {
      await this.adapter.cleanup()
      await this.adapter.initialize()
      this._status = 'idle'
      return true
    } catch {
      this._status = 'closed'
      return false
    }
  }

  async close(): Promise<void> {
    if (this._status === 'closed') return
    this._status = 'closed'
    try {
      await this.adapter.cleanup()
    } catch {
      // Best-effort cleanup
    }
    try {
      await this.adapter.dispose()
    } catch {
      // Best-effort disposal
    }
  }
}
