import type {
  ExecutionMemoryRecord,
  ExecutionMemoryQuery,
} from './types'

export class ExecutionMemoryStore {
  private static instance: ExecutionMemoryStore | null = null
  private records = new Map<string, ExecutionMemoryRecord>()

  static getInstance(): ExecutionMemoryStore {
    if (!ExecutionMemoryStore.instance) {
      ExecutionMemoryStore.instance = new ExecutionMemoryStore()
    }
    return ExecutionMemoryStore.instance
  }

  recordExecution(record: ExecutionMemoryRecord): void {
    this.records.set(record.id, record)
  }

  get(id: string): ExecutionMemoryRecord | undefined {
    return this.records.get(id)
  }

  getByExecutionId(executionId: string): ExecutionMemoryRecord | undefined {
    for (const r of this.records.values()) {
      if (r.executionId === executionId) return r
    }
    return undefined
  }

  query(query: ExecutionMemoryQuery = {}): ExecutionMemoryRecord[] {
    let result = Array.from(this.records.values())

    if (query.successOnly) {
      result = result.filter((r) => r.success)
    }
    if (query.domain) {
      const d = query.domain.toLowerCase()
      result = result.filter((r) => r.domainTargets.some((dt) => dt.toLowerCase().includes(d)))
    }
    if (query.capability) {
      const cap = query.capability
      result = result.filter((r) => r.capabilitySequence.includes(cap))
    }
    if (query.intent) {
      const intentLower = query.intent.toLowerCase()
      result = result.filter(
        (r) =>
          r.intent.toLowerCase().includes(intentLower) ||
          r.tags.some((t) => t.toLowerCase().includes(intentLower))
      )
    }

    // Sort by timestamp descending (most recent first)
    result.sort((a, b) => b.timestamp - a.timestamp)

    if (query.limit && query.limit > 0) {
      result = result.slice(0, query.limit)
    }

    return result
  }

  getBestPatternForIntent(intent: string): ExecutionMemoryRecord | undefined {
    const matching = this.query({ intent, successOnly: true })
    if (matching.length === 0) return undefined
    return matching[0]
  }

  listRecent(limit = 20): ExecutionMemoryRecord[] {
    const list = Array.from(this.records.values())
    list.sort((a, b) => b.timestamp - a.timestamp)
    return list.slice(0, limit)
  }

  clear(): void {
    this.records.clear()
  }
}
