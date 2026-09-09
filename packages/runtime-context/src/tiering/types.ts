export type StorageTier = 'hot' | 'warm' | 'cold'

export interface TieredStorageMetrics {
  hot: {
    activeSessionsCount: number
    currentObservationsCount: number
    inMemoryStateBytesEstimate: number
    lastActivityTimestamp: number
  }
  warm: {
    knowledgeItemsCount: number
    browserDomainsCount: number
    indexedDocumentsCount: number
    entitiesCount: number
    relationshipsCount: number
  }
  cold: {
    snapshotsCount: number
    executionHistoryCount: number
    replaySessionsCount: number
    archivedStateBytesEstimate: number
  }
}

export interface TierPruneOptions {
  tier: StorageTier
  olderThanMs?: number | undefined
  maxEntries?: number | undefined
}

export interface TierPruneResult {
  tier: StorageTier
  prunedCount: number
  freedBytesEstimate: number
}
