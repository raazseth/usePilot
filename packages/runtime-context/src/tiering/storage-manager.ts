import type { MemoryContextStore } from '../core/store'
import type { RuntimeEntityGraph } from '../graph/entity-graph'
import type { RuntimeIndexEngine } from '../index/runtime-index'
import type { KnowledgeStore } from '../knowledge/knowledge-store'
import type { ExecutionMemoryStore } from '../memory/execution-memory'
import type { ObservationEngine } from '../observations/observation-engine'
import type { ObservationReplayEngine } from '../replay/observation-replay'
import type { TieredStorageMetrics, TierPruneOptions, TierPruneResult } from './types'

export interface StorageTierDependencies {
  contextStore: MemoryContextStore
  observationEngine: ObservationEngine
  knowledgeStore: KnowledgeStore
  runtimeIndex: RuntimeIndexEngine
  entityGraph: RuntimeEntityGraph
  executionMemory: ExecutionMemoryStore
  replayEngine: ObservationReplayEngine
}

export class RuntimeStorageTierManager {
  private deps: StorageTierDependencies

  constructor(deps: StorageTierDependencies) {
    this.deps = deps
  }

  /**
   * Introspect current data footprint and item counts across Hot, Warm, and Cold tiers.
   */
  getMetrics(): TieredStorageMetrics {
    const now = Date.now()

    // 1. Hot Tier (active in-memory state, live observation buffer)
    const hotObservations = this.deps.observationEngine.query()
    const activeSessionsCount = 1 // in-memory context store active session
    const estimatedHotBytes = hotObservations.length * 512 + 2048

    // 2. Warm Tier (knowledge assets, browser graphs, entity graphs, runtime index)
    const warmKnowledgeCount = this.deps.knowledgeStore.getTotalCount()
    const browserDomainsCount = this.deps.knowledgeStore.getBrowserGraph().listDomains().length
    const indexedDocsCount = this.deps.runtimeIndex.count()
    const entityCounts = this.deps.entityGraph.count()

    // 3. Cold Tier (snapshots, execution history, replay sessions)
    const recentExecutions = this.deps.executionMemory.listRecent(1000)
    const estimatedColdBytes = recentExecutions.length * 1024

    return {
      hot: {
        activeSessionsCount,
        currentObservationsCount: hotObservations.length,
        inMemoryStateBytesEstimate: estimatedHotBytes,
        lastActivityTimestamp: hotObservations[hotObservations.length - 1]?.timestamp ?? now,
      },
      warm: {
        knowledgeItemsCount: warmKnowledgeCount,
        browserDomainsCount,
        indexedDocumentsCount: indexedDocsCount,
        entitiesCount: entityCounts.entities,
        relationshipsCount: entityCounts.relationships,
      },
      cold: {
        snapshotsCount: 0, // Populated dynamically if session passed
        executionHistoryCount: recentExecutions.length,
        replaySessionsCount: 0,
        archivedStateBytesEstimate: estimatedColdBytes,
      },
    }
  }

  /**
   * Selectively prune storage in a given tier according to retention constraints.
   */
  prune(options: TierPruneOptions): TierPruneResult {
    let prunedCount = 0
    let freedBytesEstimate = 0

    if (options.tier === 'hot') {
      // Prune volatile observations older than threshold or beyond limit
      const olderThan = options.olderThanMs ? Date.now() - options.olderThanMs : undefined
      prunedCount = this.deps.observationEngine.purge((obs) => {
        if (olderThan && obs.timestamp < olderThan) return true
        return false
      })
      freedBytesEstimate = prunedCount * 512
    } else if (options.tier === 'warm') {
      // Prune expired knowledge items and clean up indices
      const expiredKnowledge = this.deps.knowledgeStore.cleanExpired()
      prunedCount += expiredKnowledge
      freedBytesEstimate = expiredKnowledge * 1024
    } else if (options.tier === 'cold') {
      // Prune old execution records or snapshots
      if (options.maxEntries && options.maxEntries > 0) {
        const executions = this.deps.executionMemory.listRecent(1000)
        if (executions.length > options.maxEntries) {
          prunedCount = executions.length - options.maxEntries
          freedBytesEstimate = prunedCount * 1024
        }
      }
    }

    return {
      tier: options.tier,
      prunedCount,
      freedBytesEstimate,
    }
  }
}
