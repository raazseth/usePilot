import { describe, expect, it, beforeEach } from 'vitest'
import { RuntimeEntityGraph } from '../graph/entity-graph'
import { RuntimeContextHealthMonitor } from '../health/health-monitor'
import { RuntimeIndexEngine } from '../index/runtime-index'
import { KnowledgeStore } from '../knowledge/knowledge-store'
import { ExecutionMemoryStore } from '../memory/execution-memory'
import { ObservationEngine } from '../observations/observation-engine'

describe('RuntimeContextHealthMonitor', () => {
  let healthMonitor: RuntimeContextHealthMonitor
  let knowledgeStore: KnowledgeStore
  let runtimeIndex: RuntimeIndexEngine
  let observationEngine: ObservationEngine
  let executionMemory: ExecutionMemoryStore
  let entityGraph: RuntimeEntityGraph

  beforeEach(() => {
    knowledgeStore = new KnowledgeStore()
    runtimeIndex = new RuntimeIndexEngine()
    observationEngine = new ObservationEngine()
    executionMemory = new ExecutionMemoryStore()
    entityGraph = new RuntimeEntityGraph()

    healthMonitor = new RuntimeContextHealthMonitor({
      knowledgeStore,
      runtimeIndex,
      observationEngine,
      executionMemory,
      entityGraph,
    })
  })

  it('generates a full health report across all 6 core context subsystems', () => {
    // Add an entity and relationship
    entityGraph.addEntity({ id: 'app-1', type: 'Application', name: 'Browser' })
    entityGraph.addEntity({ id: 'site-1', type: 'Website', name: 'amazon.in' })
    entityGraph.addRelationship('app-1', 'site-1', 'opened')

    // Add observation
    observationEngine.emit({
      id: 'obs-test-1',
      type: 'browser_state',
      source: 'browser',
      confidence: 1.0,
      timestamp: Date.now(),
      provenance: {
        source: 'browser',
        timestamp: Date.now(),
        confidence: 1.0,
        adapter: 'test',
      },
      payload: {
        currentUrl: 'https://amazon.in',
        pageTitle: 'Amazon',
        domain: 'amazon.in',
        domFingerprint: 'abc1234',
        interactiveElements: [],
        viewport: { width: 1280, height: 800 },
      },
    })

    // Add browser page
    knowledgeStore.getBrowserGraph().recordPage('amazon.in', {
      path: '/cart',
      title: 'Cart',
      url: 'https://amazon.in/cart',
      forms: [],
      actions: [],
    })

    const report = healthMonitor.getHealthReport()

    expect(report.overallStatus).toBe('healthy')
    expect(report.subsystems.knowledgeStore.status).toBe('healthy')
    expect(report.subsystems.runtimeIndex.status).toBe('healthy')
    expect(report.subsystems.observationEngine.status).toBe('healthy')
    expect(report.subsystems.browserGraph.status).toBe('healthy')
    expect(report.subsystems.executionMemory.status).toBe('healthy')
    expect(report.subsystems.entityGraph.status).toBe('healthy')

    expect(report.subsystems.entityGraph.metrics['entitiesCount']).toBe(2)
    expect(report.subsystems.entityGraph.metrics['relationshipsCount']).toBe(1)
  })

  it('marks overall status degraded if browser graphs are stale', () => {
    // Add domain that is immediately stale due to invalid max age
    knowledgeStore.getBrowserGraph().recordPage('stale-site.com', {
      path: '/home',
      title: 'Old Site',
      url: 'https://stale-site.com/home',
      forms: [],
      actions: [],
    })

    // Corrupt verification
    knowledgeStore.getBrowserGraph().verifyGraph('stale-site.com', 'mismatched')

    const report = healthMonitor.getHealthReport()
    expect(report.subsystems.browserGraph.status).toBe('degraded')
    expect(report.overallStatus).toBe('degraded')
  })
})
