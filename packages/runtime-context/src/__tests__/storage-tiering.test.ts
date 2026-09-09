import { describe, expect, it, beforeEach } from 'vitest'
import { MemoryContextStore } from '../core/store'
import { RuntimeEntityGraph } from '../graph/entity-graph'
import { RuntimeIndexEngine } from '../index/runtime-index'
import { KnowledgeStore } from '../knowledge/knowledge-store'
import { ExecutionMemoryStore } from '../memory/execution-memory'
import { ObservationEngine } from '../observations/observation-engine'
import { ObservationReplayEngine } from '../replay/observation-replay'
import { RuntimeStorageTierManager } from '../tiering/storage-manager'

describe('RuntimeStorageTierManager', () => {
  let tierManager: RuntimeStorageTierManager
  let contextStore: MemoryContextStore
  let observationEngine: ObservationEngine
  let knowledgeStore: KnowledgeStore
  let runtimeIndex: RuntimeIndexEngine
  let entityGraph: RuntimeEntityGraph
  let executionMemory: ExecutionMemoryStore
  let replayEngine: ObservationReplayEngine

  beforeEach(() => {
    contextStore = new MemoryContextStore()
    observationEngine = new ObservationEngine()
    knowledgeStore = new KnowledgeStore()
    runtimeIndex = new RuntimeIndexEngine()
    entityGraph = new RuntimeEntityGraph()
    executionMemory = new ExecutionMemoryStore()
    replayEngine = new ObservationReplayEngine()

    tierManager = new RuntimeStorageTierManager({
      contextStore,
      observationEngine,
      knowledgeStore,
      runtimeIndex,
      entityGraph,
      executionMemory,
      replayEngine,
    })
  })

  it('accurately computes metrics across Hot, Warm, and Cold tiers', () => {
    // Hot Tier data
    observationEngine.emit({
      id: 'obs-hot-1',
      type: 'browser_state',
      source: 'browser',
      confidence: 1.0,
      timestamp: Date.now(),
      provenance: { source: 'browser', timestamp: Date.now(), confidence: 1.0 },
      payload: {
        currentUrl: 'https://amazon.in',
        pageTitle: 'Amazon',
        domain: 'amazon.in',
        domFingerprint: 'abc',
        interactiveElements: [],
        viewport: { width: 1280, height: 800 },
      },
    })

    // Warm Tier data
    knowledgeStore.getBrowserGraph().recordPage('amazon.in', {
      path: '/cart',
      title: 'Cart',
      url: 'https://amazon.in/cart',
      forms: [],
      actions: [],
    })
    entityGraph.addEntity({ id: 'ent-1', type: 'Website', name: 'amazon.in' })
    runtimeIndex.index({
      id: 'idx-1',
      entityType: 'download',
      title: 'Report',
      content: 'Monthly Report',
      tags: ['report'],
      provenance: { source: 'filesystem', timestamp: Date.now(), confidence: 1.0 },
      indexedAt: Date.now(),
    })

    // Cold Tier data
    executionMemory.recordExecution({
      id: 'mem-1',
      executionId: 'exec-1',
      blueprintId: 'bp-1',
      intent: 'Download report',
      capabilitySequence: ['browser', 'filesystem'],
      domainTargets: ['amazon.in'],
      success: true,
      durationMs: 1200,
      approvalCount: 1,
      verificationPassed: true,
      healingEventCount: 0,
      artifactsProducedCount: 1,
      provenance: { source: 'execution', timestamp: Date.now(), confidence: 1.0 },
      timestamp: Date.now(),
      tags: ['report'],
    })

    const metrics = tierManager.getMetrics()

    // Assert Hot tier
    expect(metrics.hot.currentObservationsCount).toBe(1)
    expect(metrics.hot.inMemoryStateBytesEstimate).toBeGreaterThan(0)

    // Assert Warm tier
    expect(metrics.warm.browserDomainsCount).toBe(1)
    expect(metrics.warm.entitiesCount).toBe(1)
    expect(metrics.warm.indexedDocumentsCount).toBe(1)

    // Assert Cold tier
    expect(metrics.cold.executionHistoryCount).toBe(1)
    expect(metrics.cold.archivedStateBytesEstimate).toBeGreaterThan(0)
  })

  it('prunes Hot tier volatile observations by age', () => {
    const oldTimestamp = Date.now() - 100000
    observationEngine.emit({
      id: 'obs-old',
      type: 'desktop_state',
      source: 'desktop',
      confidence: 1.0,
      timestamp: oldTimestamp,
      provenance: { source: 'desktop', timestamp: oldTimestamp, confidence: 1.0 },
      payload: { activeWindowTitle: 'Old Window' },
    })

    expect(tierManager.getMetrics().hot.currentObservationsCount).toBe(1)

    const pruneResult = tierManager.prune({
      tier: 'hot',
      olderThanMs: 50000,
    })

    expect(pruneResult.tier).toBe('hot')
    expect(pruneResult.prunedCount).toBe(1)
    expect(tierManager.getMetrics().hot.currentObservationsCount).toBe(0)
  })
})
