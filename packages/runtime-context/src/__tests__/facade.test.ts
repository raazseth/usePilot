import { describe, expect, it } from 'vitest'
import { createRuntimeContextFacade } from '../facade/factory'
import { RuntimeIndexEngine } from '../index/runtime-index'

describe('RuntimeContextFacade & Domain Architecture', () => {
  it('instantiates isolated facade instances via factory function', () => {
    const facade1 = createRuntimeContextFacade()
    const facade2 = createRuntimeContextFacade()

    expect(facade1).not.toBe(facade2)
    expect(facade1.query).toBeDefined()
    expect(facade1.observations).toBeDefined()
    expect(facade1.knowledge).toBeDefined()
    expect(facade1.entities).toBeDefined()
    expect(facade1.storage).toBeDefined()
    expect(facade1.replay).toBeDefined()
    expect(facade1.state).toBeDefined()
  })

  it('orchestrates hot state mutations, snapshotting, and diffing through facade.state', async () => {
    const facade = createRuntimeContextFacade()
    const sessionId = 'test-session-1'

    // Mutate state
    await facade.state.mutate(sessionId, (draft) => {
      draft.browser.currentUrl = 'https://github.com'
      draft.browser.activeDomain = 'github.com'
      draft.browser.tabCount = 1
    })

    const snap1 = facade.state.getSnapshot(sessionId)
    expect(snap1.state.browser.currentUrl).toBe('https://github.com')

    // Mutate further
    await facade.state.mutate(sessionId, (draft) => {
      draft.browser.currentUrl = 'https://github.com/pulls'
      draft.browser.tabCount = 2
      draft.filesystem.activeDownloads.push('repo.zip')
    })

    const snap2 = facade.state.getSnapshot(sessionId)
    const diff = facade.state.diff(snap1, snap2)

    expect(diff.hasChanges).toBe(true)
    expect(diff.slices.browser.modified['currentUrl']?.before).toBe('https://github.com')
    expect(diff.slices.browser.modified['currentUrl']?.after).toBe('https://github.com/pulls')
    expect(diff.slices.filesystem.modified['activeDownloads']?.after).toEqual(['repo.zip'])
  })

  it('streams observations and compiles query bundles through domain namespaces', async () => {
    const facade = createRuntimeContextFacade()
    const sessionId = 'test-sess-2'

    facade.observations.emit({
      id: 'obs-git-1',
      type: 'browser_state',
      source: 'browser',
      confidence: 1.0,
      timestamp: Date.now(),
      provenance: { source: 'browser', timestamp: Date.now(), confidence: 1.0 },
      payload: {
        currentUrl: 'https://github.com',
        pageTitle: 'GitHub',
        domain: 'github.com',
        domFingerprint: 'git-dom',
        interactiveElements: [],
        viewport: { width: 1440, height: 900 },
      },
    })

    facade.knowledge.recordPage('github.com', {
      path: '/pulls',
      title: 'Pull Requests',
      url: 'https://github.com/pulls',
      forms: [],
      actions: [],
    })

    const bundle = await facade.query.compile({
      sessionId,
      domain: 'github.com',
      includeObservations: true,
    })

    expect(bundle.recentObservations.length).toBe(1)
    expect(bundle.domainGraph?.domain).toBe('github.com')
    expect(bundle.domainGraph?.nodes['/pulls']).toBeDefined()

    const health = facade.query.health()
    expect(health.overallStatus).toBe('healthy')
  })

  it('manages multi-hop entities and handles deterministic storage invalidation', () => {
    const facade = createRuntimeContextFacade()

    // Add entities and relationship
    const site = facade.entities.addEntity({ id: 'site-amazon', type: 'Website', name: 'amazon.in' })
    const doc = facade.entities.addEntity({ id: 'doc-invoice', type: 'Document', name: 'GST Invoice' })
    facade.entities.addRelationship(site.id, doc.id, 'generated')

    const neighbors = facade.entities.getNeighbors('site-amazon', 'generated', 'outgoing')
    expect(neighbors.length).toBe(1)
    expect(neighbors[0]?.entity.id).toBe('doc-invoice')

    // Introspect storage tiers
    const metricsBefore = facade.storage.getMetrics()
    expect(metricsBefore.warm.entitiesCount).toBe(2)
    expect(metricsBefore.warm.relationshipsCount).toBe(1)

    // Trigger invalidation on website redesign
    facade.knowledge.recordPage('amazon.in', {
      path: '/orders',
      title: 'Orders',
      url: 'https://amazon.in/orders',
      forms: [],
      actions: [],
    })
    expect(facade.knowledge.getBrowserGraph('amazon.in')).toBeDefined()

    const event = facade.storage.invalidateWebsiteRedesign('amazon.in')
    expect(event.reason).toBe('website_redesign')
    expect(facade.knowledge.getBrowserGraph('amazon.in')).toBeUndefined()
  })

  it('executes atomic multi-subsystem transactions and rolls back on failure', async () => {
    const facade = createRuntimeContextFacade()
    const sessionId = 'tx-session'

    // Initial state
    await facade.state.mutate(sessionId, (draft) => {
      draft.browser.currentUrl = 'https://initial.com'
    })

    // Successful transaction
    await facade.transaction(async (tx) => {
      await tx.state.update(sessionId, (draft) => {
        draft.browser.currentUrl = 'https://tx-updated.com'
      })
      tx.entities.add({ id: 'ent-tx', type: 'Application', name: 'App' })
      tx.entities.add({ id: 'win-tx', type: 'Window', name: 'Window' })
      tx.entities.link('ent-tx', 'win-tx', 'opened')
      tx.observations.emit({
        id: 'obs-tx-1',
        type: 'desktop_state',
        source: 'desktop',
        confidence: 1.0,
        timestamp: Date.now(),
        provenance: { source: 'desktop', timestamp: Date.now(), confidence: 1.0 },
        payload: { activeWindowTitle: 'Window' },
      })
    })

    expect(facade.state.getSnapshot(sessionId).state.browser.currentUrl).toBe('https://tx-updated.com')
    expect(facade.entities.getEntity('ent-tx')).toBeDefined()
    expect(facade.observations.query().length).toBe(1)

    // Failing transaction with automatic rollback
    await expect(
      facade.transaction(async (tx) => {
        await tx.state.update(sessionId, (draft) => {
          draft.browser.currentUrl = 'https://corrupted.com'
        })
        tx.entities.add({ id: 'ent-fail', type: 'Application', name: 'FailApp' })
        tx.observations.emit({
          id: 'obs-fail-1',
          type: 'desktop_state',
          source: 'desktop',
          confidence: 1.0,
          timestamp: Date.now(),
          provenance: { source: 'desktop', timestamp: Date.now(), confidence: 1.0 },
          payload: { activeWindowTitle: 'FailWindow' },
        })
        throw new Error('Simulated atomic failure')
      })
    ).rejects.toThrow('Simulated atomic failure')

    // Verify rollback: state returned to pre-transaction URL
    expect(facade.state.getSnapshot(sessionId).state.browser.currentUrl).toBe('https://tx-updated.com')
    // Verify entity was rolled back
    expect(facade.entities.getEntity('ent-fail')).toBeUndefined()
    // Verify observation was rolled back
    expect(facade.observations.query().find((o) => o.id === 'obs-fail-1')).toBeUndefined()
  })

  it('supports dependency injection with custom store overrides', () => {
    class CustomIndexEngine extends RuntimeIndexEngine {
      override count() {
        return 999
      }
    }

    const facade = createRuntimeContextFacade({
      dependencies: {
        runtimeIndex: new CustomIndexEngine(),
      },
    })

    expect(facade.storage.countIndex()).toBe(999)
  })

  it('verifies contextSchemaVersion is tracked on state and snapshots', () => {
    const facade = createRuntimeContextFacade()
    const snapshot = facade.state.getSnapshot('schema-session')

    expect(snapshot.contextSchemaVersion).toBe(1)
    expect(snapshot.state.contextSchemaVersion).toBe(1)
  })
})

