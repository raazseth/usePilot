import type {
  IndexDocument,
  SearchQuery,
  SearchResult,
  IndexedEntityType,
} from './types'

export class RuntimeIndexEngine {
  private static instance: RuntimeIndexEngine | null = null
  private documents = new Map<string, IndexDocument>()

  static getInstance(): RuntimeIndexEngine {
    if (!RuntimeIndexEngine.instance) {
      RuntimeIndexEngine.instance = new RuntimeIndexEngine()
    }
    return RuntimeIndexEngine.instance
  }

  index(document: IndexDocument): void {
    this.documents.set(document.id, document)
  }

  indexBatch(docs: IndexDocument[]): void {
    for (const d of docs) {
      this.documents.set(d.id, d)
    }
  }

  get(id: string): IndexDocument | undefined {
    return this.documents.get(id)
  }

  remove(id: string): boolean {
    return this.documents.delete(id)
  }

  search(options: SearchQuery): SearchResult[] {
    const rawTerms = options.query
      .toLowerCase()
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)

    const candidates: SearchResult[] = []

    for (const doc of this.documents.values()) {
      // 1. Filter by entity types
      if (options.entityTypes && options.entityTypes.length > 0) {
        if (!options.entityTypes.includes(doc.entityType)) continue
      }

      // 2. Filter by tags
      if (options.tags && options.tags.length > 0) {
        const hasTag = options.tags.some((t) => doc.tags.includes(t))
        if (!hasTag) continue
      }

      // 3. Filter by date range
      if (typeof options.fromTimestamp === 'number' && doc.indexedAt < options.fromTimestamp) {
        continue
      }
      if (typeof options.toTimestamp === 'number' && doc.indexedAt > options.toTimestamp) {
        continue
      }

      // 4. Score matching
      const contentLower = doc.content.toLowerCase()
      const titleLower = doc.title.toLowerCase()

      let keywordScore = 0
      const highlights: string[] = []

      for (const term of rawTerms) {
        if (titleLower.includes(term)) {
          keywordScore += 3.0 // Higher weight for title matches
          highlights.push(`Title match: "${term}"`)
        }
        if (contentLower.includes(term)) {
          keywordScore += 1.0
          const matchIdx = contentLower.indexOf(term)
          const start = Math.max(0, matchIdx - 20)
          const snippet = doc.content.slice(start, start + 60).replace(/[\r\n]+/g, ' ')
          highlights.push(`...${snippet}...`)
        }
      }

      // Vector cosine similarity if vectors provided
      let vectorScore = 0
      if (options.vector && doc.vector && options.vector.length === doc.vector.length) {
        vectorScore = this.cosineSimilarity(options.vector, doc.vector)
      }

      if (rawTerms.length === 0 && !options.vector) {
        // Broad search without text query: return matching filters
        candidates.push({
          document: doc,
          score: 1.0,
          matchType: 'exact',
          highlights: ['Matched by filter'],
        })
        continue
      }

      const totalScore = keywordScore + vectorScore * 2.0
      if (totalScore > 0) {
        let matchType: SearchResult['matchType'] = 'keyword'
        if (keywordScore > 0 && vectorScore > 0.5) matchType = 'hybrid'
        else if (vectorScore > 0.5 && keywordScore === 0) matchType = 'semantic'

        candidates.push({
          document: doc,
          score: Math.round(totalScore * 100) / 100,
          matchType,
          highlights: highlights.slice(0, 3),
        })
      }
    }

    // Sort by descending score
    candidates.sort((a, b) => b.score - a.score)

    const limit = options.limit ?? 20
    return candidates.slice(0, limit)
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0
    let magA = 0
    let magB = 0
    for (let i = 0; i < a.length; i++) {
      const valA = a[i] ?? 0
      const valB = b[i] ?? 0
      dot += valA * valB
      magA += valA * valA
      magB += valB * valB
    }
    const mag = Math.sqrt(magA) * Math.sqrt(magB)
    return mag === 0 ? 0 : dot / mag
  }

  count(entityType?: IndexedEntityType): number {
    if (!entityType) return this.documents.size
    let count = 0
    for (const d of this.documents.values()) {
      if (d.entityType === entityType) count++
    }
    return count
  }

  clear(): void {
    this.documents.clear()
  }
}
