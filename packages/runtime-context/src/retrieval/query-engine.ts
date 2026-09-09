import type { MemoryContextStore } from '../core/store'
import type { ContextSnapshot } from '../core/types'
import type { RuntimeIndexEngine } from '../index/runtime-index'
import type { SearchQuery, SearchResult } from '../index/types'
import type { KnowledgeStore } from '../knowledge/knowledge-store'
import type { DomainKnowledgeGraph, KnowledgeItem } from '../knowledge/types'
import type { ExecutionMemoryStore } from '../memory/execution-memory'
import type { ExecutionMemoryQuery, ExecutionMemoryRecord } from '../memory/types'
import type { ObservationEngine } from '../observations/observation-engine'
import type { Observation, ObservationFilter } from '../observations/types'
import type { MultiDomainQuery, RuntimeContextBundle } from './types'

export interface QueryEngineDependencies {
  contextStore: MemoryContextStore
  observationEngine: ObservationEngine
  knowledgeStore: KnowledgeStore
  indexEngine: RuntimeIndexEngine
  executionMemory: ExecutionMemoryStore
}

export class RuntimeQueryEngine {
  private static instance: RuntimeQueryEngine | null = null
  private deps: QueryEngineDependencies

  constructor(deps: QueryEngineDependencies) {
    this.deps = deps
  }

  static getInstance(deps?: QueryEngineDependencies): RuntimeQueryEngine {
    if (!RuntimeQueryEngine.instance) {
      if (!deps) {
        throw new Error('RuntimeQueryEngine requires dependencies on initial instantiation')
      }
      RuntimeQueryEngine.instance = new RuntimeQueryEngine(deps)
    }
    return RuntimeQueryEngine.instance
  }

  /**
   * Primary context compilation method consumed by Planner, Agents, and Services.
   */
  async query(options: MultiDomainQuery): Promise<RuntimeContextBundle> {
    const recentObservations: Observation[] = options.includeObservations !== false
      ? this.observe({ limit: 20 })
      : []

    const domainGraph = options.domain
      ? this.graph(options.domain)
      : undefined

    let relevantDocuments: SearchResult[] = []
    if (options.includeDocuments !== false && options.intent) {
      relevantDocuments = this.search({ query: options.intent, limit: 5 })
    }

    const cachedKnowledge: KnowledgeItem[] = options.includeKnowledge !== false
      ? this.deps.knowledgeStore.listByCategory('persistent')
      : []

    const previousExecutions: ExecutionMemoryRecord[] = options.includeExecutions !== false
      ? this.executions({
          intent: options.intent,
          domain: options.domain,
          limit: 5,
        })
      : []

    const bestExecutionPattern = options.intent
      ? this.deps.executionMemory.getBestPatternForIntent(options.intent)
      : undefined

    return {
      sessionId: options.sessionId,
      recentObservations,
      domainGraph,
      relevantDocuments,
      cachedKnowledge,
      previousExecutions,
      bestExecutionPattern,
      generatedAt: Date.now(),
    }
  }

  /**
   * Search semantic and keyword runtime index.
   */
  search(query: SearchQuery): SearchResult[] {
    return this.deps.indexEngine.search(query)
  }

  /**
   * Direct key lookup across persistent knowledge, documents, and cached data.
   */
  lookup<T = unknown>(key: string): T | undefined {
    // Check persistent knowledge
    const persistent = this.deps.knowledgeStore.getPersistent<T>(key)
    if (persistent !== undefined) return persistent

    // Check cache
    const cached = this.deps.knowledgeStore.getCache<T>(key)
    if (cached !== undefined) return cached

    // Check documents
    const doc = this.deps.knowledgeStore.getDocument<T>(key)
    if (doc !== undefined) return doc

    return undefined
  }

  /**
   * Query latest state observations.
   */
  observe(filter?: ObservationFilter): Observation[] {
    return this.deps.observationEngine.query(filter)
  }

  /**
   * Retrieve state history and immutable snapshots for a session.
   */
  async history(sessionId: string): Promise<ContextSnapshot[]> {
    return this.deps.contextStore.listSnapshots(sessionId)
  }

  /**
   * Retrieve the structured knowledge graph for a visited domain.
   */
  graph(domain: string): DomainKnowledgeGraph | undefined {
    return this.deps.knowledgeStore.getBrowserGraph().getDomainGraph(domain)
  }

  /**
   * Retrieve documents and parsed tables from the knowledge store.
   */
  documents(docId?: string): unknown {
    if (docId) {
      return this.deps.knowledgeStore.getDocument(docId)
    }
    return this.deps.knowledgeStore.listByCategory('document')
  }

  /**
   * Query execution memory and reusable workflow history.
   */
  executions(query?: ExecutionMemoryQuery): ExecutionMemoryRecord[] {
    return this.deps.executionMemory.query(query)
  }
}
