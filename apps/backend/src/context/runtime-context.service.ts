import { MemoryContextStore } from '@usepilot/runtime-context'
import type { ContextSnapshot, RuntimeContext } from '@usepilot/runtime-context'

export class RuntimeContextService {
  private static instance: RuntimeContextService | null = null
  private store: MemoryContextStore

  constructor(store = MemoryContextStore.getInstance()) {
    this.store = store
  }

  static getInstance(): RuntimeContextService {
    if (!RuntimeContextService.instance) {
      RuntimeContextService.instance = new RuntimeContextService()
    }
    return RuntimeContextService.instance
  }

  getStore(): MemoryContextStore {
    return this.store
  }

  getContext(sessionId: string): RuntimeContext {
    return this.store.getOrCreate(sessionId)
  }

  async snapshot(sessionId: string): Promise<ContextSnapshot> {
    const ctx = this.store.getOrCreate(sessionId)
    const snap = ctx.createSnapshot()
    await this.store.saveSnapshot(snap)
    return snap
  }

  rollback(sessionId: string, snapshotId: string): boolean {
    const ctx = this.store.get(sessionId)
    if (!ctx) return false
    return ctx.rollbackToSnapshot(snapshotId)
  }
}
