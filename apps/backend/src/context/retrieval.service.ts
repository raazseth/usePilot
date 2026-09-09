import {
  RuntimeQueryEngine,
  MemoryContextStore,
  ObservationEngine,
  KnowledgeStore,
  RuntimeIndexEngine,
  ExecutionMemoryStore,
  RuntimeEntityGraph,
} from '@usepilot/runtime-context'
import type { MultiDomainQuery, RuntimeContextBundle, SearchQuery, SearchResult } from '@usepilot/runtime-context'

export class RetrievalService {
  private static instance: RetrievalService | null = null
  private queryEngine: RuntimeQueryEngine

  constructor(
    contextStore = MemoryContextStore.getInstance(),
    observationEngine = ObservationEngine.getInstance(),
    knowledgeStore = KnowledgeStore.getInstance(),
    indexEngine = RuntimeIndexEngine.getInstance(),
    executionMemory = ExecutionMemoryStore.getInstance(),
    entityGraph = RuntimeEntityGraph.getInstance()
  ) {
    this.queryEngine = new RuntimeQueryEngine({
      contextStore,
      observationEngine,
      knowledgeStore,
      indexEngine,
      executionMemory,
      entityGraph,
    })
  }

  static getInstance(): RetrievalService {
    if (!RetrievalService.instance) {
      RetrievalService.instance = new RetrievalService()
    }
    return RetrievalService.instance
  }

  getQueryEngine(): RuntimeQueryEngine {
    return this.queryEngine
  }

  async query(options: MultiDomainQuery): Promise<RuntimeContextBundle> {
    return this.queryEngine.query(options)
  }

  search(query: SearchQuery): SearchResult[] {
    return this.queryEngine.search(query)
  }
}
