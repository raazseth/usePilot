import type { ContextSnapshot } from '../core/types'
import type { DomainKnowledgeGraph, KnowledgeItem } from '../knowledge/types'
import type { ExecutionMemoryRecord } from '../memory/types'
import type { Observation } from '../observations/types'
import type { SearchResult } from '../index/types'

export interface MultiDomainQuery {
  intent?: string | undefined
  domain?: string | undefined
  sessionId?: string | undefined
  includeObservations?: boolean | undefined
  includeKnowledge?: boolean | undefined
  includeDocuments?: boolean | undefined
  includeExecutions?: boolean | undefined
}

export interface RuntimeContextBundle {
  sessionId?: string | undefined
  recentObservations: Observation[]
  domainGraph?: DomainKnowledgeGraph | undefined
  relevantDocuments: SearchResult[]
  cachedKnowledge: KnowledgeItem[]
  previousExecutions: ExecutionMemoryRecord[]
  bestExecutionPattern?: ExecutionMemoryRecord | undefined
  generatedAt: number
}
