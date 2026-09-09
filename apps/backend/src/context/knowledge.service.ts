import { KnowledgeStore } from '@usepilot/runtime-context'
import type { ContextProvenance, KnowledgeItem, DomainKnowledgeGraph } from '@usepilot/runtime-context'

export class KnowledgeService {
  private static instance: KnowledgeService | null = null
  private store: KnowledgeStore

  constructor(store = KnowledgeStore.getInstance()) {
    this.store = store
  }

  static getInstance(): KnowledgeService {
    if (!KnowledgeService.instance) {
      KnowledgeService.instance = new KnowledgeService()
    }
    return KnowledgeService.instance
  }

  getStore(): KnowledgeStore {
    return this.store
  }

  savePersistentFact<T>(key: string, data: T, provenance: ContextProvenance): KnowledgeItem<T> {
    return this.store.setPersistent(key, data, provenance)
  }

  getDomainGraph(domain: string): DomainKnowledgeGraph | undefined {
    return this.store.getBrowserGraph().getDomainGraph(domain)
  }
}
