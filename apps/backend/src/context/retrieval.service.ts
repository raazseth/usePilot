import {
  createRuntimeContextFacade,
  type RuntimeContextFacade,
} from '@usepilot/runtime-context'
import type { MultiDomainQuery, RuntimeContextBundle, SearchQuery, SearchResult } from '@usepilot/runtime-context'

export class RetrievalService {
  private static instance: RetrievalService | null = null
  private facade: RuntimeContextFacade

  constructor(facade = createRuntimeContextFacade()) {
    this.facade = facade
  }

  static getInstance(): RetrievalService {
    if (!RetrievalService.instance) {
      RetrievalService.instance = new RetrievalService()
    }
    return RetrievalService.instance
  }

  getFacade(): RuntimeContextFacade {
    return this.facade
  }

  async query(options: MultiDomainQuery): Promise<Readonly<RuntimeContextBundle>> {
    return this.facade.query.compile(options)
  }

  search(query: SearchQuery): SearchResult[] {
    return this.facade.query.search(query)
  }
}

