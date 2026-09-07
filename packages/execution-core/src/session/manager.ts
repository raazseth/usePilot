// SessionManager — manages adapter sessions across execution runs

import type { TaskCapability } from '@usepilot/planner-types'
import type {
  ISessionManager,
  IAdapterSession,
  ICapabilityAdapter,
  SessionScope,
  SessionManagerOptions,
} from '@usepilot/execution-types'
import { AdapterSession } from './session'
import { AdapterSandbox } from '../sandbox'
import type { ExecutionResourceManager } from '../resource-manager'

export class SessionManager implements ISessionManager {
  private readonly sessions = new Map<string, AdapterSession>()
  private readonly scopedSessions = new Map<string, AdapterSession>()
  private readonly defaultScope: SessionScope
  private readonly sandbox: AdapterSandbox
  private readonly resourceManager?: ExecutionResourceManager | undefined

  constructor(
    options: SessionManagerOptions = {},
    dependencies: {
      sandbox?: AdapterSandbox
      resourceManager?: ExecutionResourceManager
    } = {}
  ) {
    this.defaultScope = options.defaultScope ?? 'capability'
    this.sandbox = dependencies.sandbox ?? new AdapterSandbox()
    this.resourceManager = dependencies.resourceManager
  }

  async getOrCreateSession(
    runId: string,
    capability: TaskCapability,
    adapter: ICapabilityAdapter,
    scope?: SessionScope
  ): Promise<IAdapterSession> {
    const effectiveScope = scope ?? this.defaultScope

    if (effectiveScope === 'task') {
      const session = new AdapterSession(runId, capability, adapter, this.sandbox)
      await adapter.initialize()
      this.sessions.set(session.id, session)
      this.registerWithResourceManager(session)
      return session
    }

    const scopeKey =
      effectiveScope === 'run'
        ? `${runId}:adapter:${adapter.name}`
        : `${runId}:capability:${capability}`

    const existing = this.scopedSessions.get(scopeKey)
    if (existing && existing.status !== 'closed') {
      if (existing.status === 'panicked') {
        const recovered = await existing.recover()
        if (recovered) {
          return existing
        }
        // If recovery failed, clear dead session and proceed to create a fresh one
        this.scopedSessions.delete(scopeKey)
        this.sessions.delete(existing.id)
      } else {
        return existing
      }
    }

    await adapter.initialize()
    const session = new AdapterSession(runId, capability, adapter, this.sandbox)
    this.sessions.set(session.id, session)
    this.scopedSessions.set(scopeKey, session)
    this.registerWithResourceManager(session)

    return session
  }

  getSession(sessionId: string): IAdapterSession | undefined {
    return this.sessions.get(sessionId)
  }

  listActiveSessions(): IAdapterSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.status !== 'closed')
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return

    await session.close()
    this.sessions.delete(sessionId)

    // Clear scoped references
    for (const [key, s] of this.scopedSessions.entries()) {
      if (s.id === sessionId) {
        this.scopedSessions.delete(key)
      }
    }
  }

  async closeAll(): Promise<void> {
    const sessions = Array.from(this.sessions.values())
    this.sessions.clear()
    this.scopedSessions.clear()

    await Promise.all(
      sessions.map(async (session) => {
        try {
          await session.close()
        } catch {
          // Best-effort cleanup
        }
      })
    )
  }

  private registerWithResourceManager(session: AdapterSession): void {
    if (!this.resourceManager) return
    this.resourceManager.register({
      id: `session-${session.id}`,
      type: 'session',
      description: `Session ${session.id} (${session.adapter.name} for ${session.capability})`,
      dispose: () => session.close(),
      registeredAt: Date.now(),
    })
  }
}
