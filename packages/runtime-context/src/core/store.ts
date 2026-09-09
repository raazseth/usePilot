import { RuntimeContext } from './context'
import type { ContextSnapshot } from './types'

export interface IContextStore {
  getOrCreate(sessionId: string): RuntimeContext
  get(sessionId: string): RuntimeContext | undefined
  saveSnapshot(snapshot: ContextSnapshot): Promise<void>
  listSnapshots(sessionId: string): Promise<ContextSnapshot[]>
  deleteSession(sessionId: string): Promise<boolean>
}

export class MemoryContextStore implements IContextStore {
  private static instance: MemoryContextStore | null = null
  private contexts = new Map<string, RuntimeContext>()
  private persistedSnapshots = new Map<string, ContextSnapshot[]>()

  static getInstance(): MemoryContextStore {
    if (!MemoryContextStore.instance) {
      MemoryContextStore.instance = new MemoryContextStore()
    }
    return MemoryContextStore.instance
  }

  getOrCreate(sessionId: string): RuntimeContext {
    let ctx = this.contexts.get(sessionId)
    if (!ctx) {
      ctx = new RuntimeContext(sessionId)
      this.contexts.set(sessionId, ctx)
    }
    return ctx
  }

  get(sessionId: string): RuntimeContext | undefined {
    return this.contexts.get(sessionId)
  }

  async saveSnapshot(snapshot: ContextSnapshot): Promise<void> {
    const list = this.persistedSnapshots.get(snapshot.sessionId) ?? []
    list.push(snapshot)
    this.persistedSnapshots.set(snapshot.sessionId, list)
  }

  async listSnapshots(sessionId: string): Promise<ContextSnapshot[]> {
    return [...(this.persistedSnapshots.get(sessionId) ?? [])]
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    this.persistedSnapshots.delete(sessionId)
    return this.contexts.delete(sessionId)
  }
}
