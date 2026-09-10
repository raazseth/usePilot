import type { RuntimeContext } from '../../core/context'
import type { MemoryContextStore } from '../../core/store'
import type {
  ContextSnapshot,
  StateMutationFn,
} from '../../core/types'
import { ContextDiffEngine } from '../../diff/diff-engine'
import type { ContextDiff } from '../../diff/types'

export class StateDomain {
  private contextStore: MemoryContextStore

  constructor(contextStore: MemoryContextStore) {
    this.contextStore = contextStore
  }

  get(sessionId: string): RuntimeContext | undefined {
    return this.contextStore.get(sessionId)
  }

  getOrCreate(sessionId: string): RuntimeContext {
    return this.contextStore.getOrCreate(sessionId)
  }

  async mutate(
    sessionId: string,
    mutation: StateMutationFn
  ): Promise<ContextSnapshot> {
    const context = this.contextStore.getOrCreate(sessionId)
    return context.mutate(mutation)
  }

  getSnapshot(sessionId: string): ContextSnapshot {
    const context = this.contextStore.getOrCreate(sessionId)
    return context.getLatestSnapshot() ?? context.createSnapshot()
  }

  async listSnapshots(sessionId: string): Promise<ContextSnapshot[]> {
    return this.contextStore.listSnapshots(sessionId)
  }

  diff(snapshotA: ContextSnapshot, snapshotB: ContextSnapshot): ContextDiff {
    return ContextDiffEngine.diff(snapshotA, snapshotB)
  }
}
