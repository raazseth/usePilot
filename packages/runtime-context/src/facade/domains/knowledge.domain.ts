import type { ContextProvenance } from '../../core/provenance'
import type { KnowledgeStore } from '../../knowledge/knowledge-store'
import type {
  BrowserPageNode,
  DomainKnowledgeGraph,
  FormFieldDescriptor,
  PageActionDescriptor,
  KnowledgeItem,
} from '../../knowledge/types'

export class KnowledgeDomain {
  private knowledgeStore: KnowledgeStore

  constructor(knowledgeStore: KnowledgeStore) {
    this.knowledgeStore = knowledgeStore
  }

  // --- Browser Knowledge Graph ---

  recordPage(
    domain: string,
    page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>,
    provenance?: ContextProvenance
  ): BrowserPageNode {
    return this.knowledgeStore.getBrowserGraph().recordPage(domain, page, provenance)
  }

  recordForm(domain: string, path: string, form: FormFieldDescriptor): boolean {
    return this.knowledgeStore.getBrowserGraph().recordForm(domain, path, form)
  }

  recordAction(domain: string, path: string, action: PageActionDescriptor): boolean {
    return this.knowledgeStore.getBrowserGraph().recordAction(domain, path, action)
  }

  setAuthentication(domain: string, authenticated: boolean): void {
    this.knowledgeStore.getBrowserGraph().setAuthentication(domain, authenticated)
  }

  getBrowserGraph(domain: string): DomainKnowledgeGraph | undefined {
    return this.knowledgeStore.getBrowserGraph().getDomainGraph(domain)
  }

  isBrowserGraphStale(domain: string, maxAgeMs?: number): boolean {
    return this.knowledgeStore.getBrowserGraph().isStale(domain, maxAgeMs)
  }

  verifyBrowserGraph(domain: string, fingerprint?: string, confidence?: number): boolean {
    return this.knowledgeStore.getBrowserGraph().verifyGraph(domain, fingerprint, confidence)
  }

  // --- Persistent & Cached Assets ---

  setPersistent<T>(key: string, data: T, provenance: ContextProvenance): KnowledgeItem<T> {
    return this.knowledgeStore.setPersistent(key, data, provenance)
  }

  getPersistent<T>(key: string): T | undefined {
    return this.knowledgeStore.getPersistent<T>(key)
  }

  setCache<T>(key: string, data: T, provenance: ContextProvenance, ttlSeconds = 300): KnowledgeItem<T> {
    return this.knowledgeStore.setCache(key, data, provenance, ttlSeconds)
  }

  getCache<T>(key: string): T | undefined {
    return this.knowledgeStore.getCache<T>(key)
  }

  cleanExpired(): number {
    return this.knowledgeStore.cleanExpired()
  }
}
