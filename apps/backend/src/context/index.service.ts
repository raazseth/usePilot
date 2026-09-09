import { RuntimeIndexEngine } from '@usepilot/runtime-context'
import type { IndexDocument, SearchQuery, SearchResult } from '@usepilot/runtime-context'

export class IndexService {
  private static instance: IndexService | null = null
  private engine: RuntimeIndexEngine

  constructor(engine = RuntimeIndexEngine.getInstance()) {
    this.engine = engine
  }

  static getInstance(): IndexService {
    if (!IndexService.instance) {
      IndexService.instance = new IndexService()
    }
    return IndexService.instance
  }

  getEngine(): RuntimeIndexEngine {
    return this.engine
  }

  index(document: IndexDocument): void {
    this.engine.index(document)
  }

  search(query: SearchQuery): SearchResult[] {
    return this.engine.search(query)
  }
}
