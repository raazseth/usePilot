import type { ContextProvenance } from '../core/provenance'

export type IndexedEntityType =
  | 'pdf'
  | 'document'
  | 'download'
  | 'screenshot'
  | 'ocr'
  | 'browser_page'
  | 'execution_report'
  | 'note'
  | 'clipboard'

export interface IndexDocument {
  id: string
  entityType: IndexedEntityType
  title: string
  content: string
  tags: string[]
  metadata?: Record<string, unknown> | undefined
  provenance: ContextProvenance
  vector?: number[] | undefined
  indexedAt: number
}

export interface SearchQuery {
  query: string
  entityTypes?: IndexedEntityType[] | undefined
  tags?: string[] | undefined
  fromTimestamp?: number | undefined
  toTimestamp?: number | undefined
  vector?: number[] | undefined
  limit?: number | undefined
}

export interface SearchResult {
  document: IndexDocument
  score: number // Combined relevance score 0.0 - 1.0+
  matchType: 'exact' | 'keyword' | 'semantic' | 'hybrid'
  highlights: string[]
}
