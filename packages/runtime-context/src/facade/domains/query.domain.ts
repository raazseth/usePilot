import type { RuntimeContextHealthReport } from '../../health/types'
import type { SearchQuery, SearchResult } from '../../index/types'
import type { RuntimeQueryEngine } from '../../retrieval/query-engine'
import type { MultiDomainQuery, RuntimeContextBundle } from '../../retrieval/types'

export class QueryDomain {
  private queryEngine: RuntimeQueryEngine

  constructor(queryEngine: RuntimeQueryEngine) {
    this.queryEngine = queryEngine
  }

  async compile(options: MultiDomainQuery): Promise<Readonly<RuntimeContextBundle>> {
    return this.queryEngine.query(options)
  }

  search(query: SearchQuery): SearchResult[] {
    return this.queryEngine.search(query)
  }

  lookup<T = unknown>(key: string): T | undefined {
    return this.queryEngine.lookup<T>(key)
  }

  health(): RuntimeContextHealthReport {
    return this.queryEngine.health()
  }
}
