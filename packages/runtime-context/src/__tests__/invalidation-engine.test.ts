import { describe, expect, it, beforeEach } from 'vitest'
import { RuntimeEntityGraph } from '../graph/entity-graph'
import { RuntimeIndexEngine } from '../index/runtime-index'
import { ContextInvalidationEngine } from '../invalidation/invalidation-engine'
import type { InvalidationEvent } from '../invalidation/types'
import { KnowledgeStore } from '../knowledge/knowledge-store'
import { ObservationEngine } from '../observations/observation-engine'

describe('ContextInvalidationEngine', () => {
  let invalidationEngine: ContextInvalidationEngine
  let knowledgeStore: KnowledgeStore
  let observationEngine: ObservationEngine
  let runtimeIndex: RuntimeIndexEngine
  let entityGraph: RuntimeEntityGraph

  beforeEach(() => {
    knowledgeStore = new KnowledgeStore()
    observationEngine = new ObservationEngine()
    runtimeIndex = new RuntimeIndexEngine()
    entityGraph = new RuntimeEntityGraph()

    invalidationEngine = new ContextInvalidationEngine({
      knowledgeStore,
      observationEngine,
      runtimeIndex,
      entityGraph,
    })
  })

  it('invalidates browser graph, index docs, and observations on user logout', () => {
    // Populate domain and page
    knowledgeStore.getBrowserGraph().recordPage('amazon.in', {
      path: '/orders',
      title: 'Your Orders',
      url: 'https://amazon.in/orders',
      forms: [],
      actions: [],
    })
    knowledgeStore.getBrowserGraph().setAuthentication('amazon.in', true)

    // Add observation for domain
    observationEngine.emit({
      id: 'obs-1',
      type: 'browser_state',
      source: 'browser',
      confidence: 1.0,
      timestamp: Date.now(),
      provenance: { source: 'browser', timestamp: Date.now(), confidence: 1.0 },
      payload: {
        currentUrl: 'https://amazon.in/orders',
        pageTitle: 'Your Orders',
        domain: 'amazon.in',
        domFingerprint: 'hash1',
        interactiveElements: [],
        viewport: { width: 1280, height: 800 },
      },
    })

    const events: InvalidationEvent[] = []
    invalidationEngine.onInvalidation((evt) => events.push(evt))

    const event = invalidationEngine.invalidateUserLogout('amazon.in')

    expect(event.reason).toBe('user_logout')
    expect(event.target).toBe('amazon.in')
    expect(event.invalidatedCount.observations).toBe(1)
    expect(event.invalidatedCount.graphNodes).toBe(1)

    // Verify browser graph domain is purged
    expect(knowledgeStore.getBrowserGraph().getDomainGraph('amazon.in')).toBeUndefined()
    // Verify observation is purged
    expect(observationEngine.query().length).toBe(0)
    // Verify event was emitted to subscriber
    expect(events.length).toBe(1)
  })

  it('invalidates index documents, entities, and relationships on file deletion', () => {
    const filePath = 'E:/usePilot/downloads/invoice.pdf'

    // Add document to index
    runtimeIndex.index({
      id: 'doc-inv-1',
      entityType: 'download',
      title: 'Invoice PDF',
      uri: filePath,
      content: 'Tax invoice details and receipt',
      tags: ['invoice'],
      provenance: { source: 'filesystem', timestamp: Date.now(), confidence: 1.0 },
      indexedAt: Date.now(),
    })
    expect(runtimeIndex.count('download')).toBe(1)

    // Add entity and relationship
    entityGraph.addEntity({ id: filePath, type: 'File', name: 'invoice.pdf' })
    entityGraph.addEntity({ id: 'task-1', type: 'Task', name: 'Process invoice' })
    entityGraph.addRelationship(filePath, 'task-1', 'belongs_to')
    expect(entityGraph.count().entities).toBe(2)
    expect(entityGraph.count().relationships).toBe(1)

    const event = invalidationEngine.invalidateFileDeleted(filePath)

    expect(event.reason).toBe('file_deleted')
    expect(event.invalidatedCount.indexDocuments).toBe(1)
    expect(event.invalidatedCount.entities).toBe(1)
    expect(event.invalidatedCount.relationships).toBe(1)

    // Verify index doc removed
    expect(runtimeIndex.count('download')).toBe(0)
    // Verify entity removed
    expect(entityGraph.getEntity(filePath)).toBeUndefined()
    expect(entityGraph.count().entities).toBe(1)
    expect(entityGraph.count().relationships).toBe(0)
  })

  it('invalidates on website redesign and records event in history', () => {
    knowledgeStore.getBrowserGraph().recordPage('stripe.com', {
      path: '/dashboard',
      title: 'Stripe Dashboard',
      url: 'https://stripe.com/dashboard',
      forms: [],
      actions: [],
    })

    const event = invalidationEngine.invalidateWebsiteRedesign('stripe.com')
    expect(event.reason).toBe('website_redesign')
    expect(knowledgeStore.getBrowserGraph().getDomainGraph('stripe.com')).toBeUndefined()

    const history = invalidationEngine.getHistory()
    expect(history.length).toBe(1)
    expect(history[0]?.id).toBe(event.id)
  })
})
