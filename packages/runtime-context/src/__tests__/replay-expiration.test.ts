import { describe, it, expect } from 'vitest'

import { createProvenance } from '../core/provenance'
import { MemoryContextStore } from '../core/store'
import { ContextExpirationManager } from '../expiration/expiration-manager'
import { KnowledgeStore } from '../knowledge/knowledge-store'
import type { BrowserObservation, FilesystemObservation, Observation } from '../observations/types'
import { ObservationReplayEngine } from '../replay/observation-replay'

describe('Observation Replay & Context Expiration (Deliverables 8 & 9)', () => {
  it('ObservationReplayEngine steps through historical state perceptions deterministically', () => {
    const prov = createProvenance('browser')

    const obs1: BrowserObservation = {
      id: 'obs-rep-1',
      type: 'browser_state',
      timestamp: 1000,
      source: 'browser',
      confidence: 1.0,
      provenance: prov,
      payload: {
        currentUrl: 'https://store.com/home',
        pageTitle: 'Home',
        domain: 'store.com',
        domFingerprint: 'fp-home',
        interactiveElements: [],
        viewport: { width: 1280, height: 720 },
      },
    }

    const obs2: FilesystemObservation = {
      id: 'obs-rep-2',
      type: 'filesystem_state',
      timestamp: 2000,
      source: 'filesystem',
      confidence: 1.0,
      provenance: prov,
      payload: {
        targetPath: '/temp/catalog.json',
        exists: true,
        sizeBytes: 4096,
        isWritable: true,
        isDirectory: false,
      },
    }

    const obs3: BrowserObservation = {
      id: 'obs-rep-3',
      type: 'browser_state',
      timestamp: 3000,
      source: 'browser',
      confidence: 1.0,
      provenance: prov,
      payload: {
        currentUrl: 'https://store.com/cart',
        pageTitle: 'Shopping Cart',
        domain: 'store.com',
        domFingerprint: 'fp-cart',
        interactiveElements: [],
        viewport: { width: 1280, height: 720 },
      },
    }

    const replay = new ObservationReplayEngine([obs1, obs2, obs3])
    expect(replay.getTotalSteps()).toBe(3)
    expect(replay.getCurrentStep()).toBe(0)

    // Initial step snapshot
    const frame0 = replay.getCurrentSnapshot()
    expect(frame0.browser?.currentUrl).toBe('https://store.com/home')
    expect(frame0.filesystem).toBeUndefined()

    // Step to step 1
    const frame1 = replay.stepForward()
    expect(frame1?.stepIndex).toBe(1)
    expect(frame1?.browser?.currentUrl).toBe('https://store.com/home')
    expect(frame1?.filesystem?.lastPath).toBe('/temp/catalog.json')

    // Step to step 2
    const frame2 = replay.stepForward()
    expect(frame2?.stepIndex).toBe(2)
    expect(frame2?.browser?.currentUrl).toBe('https://store.com/cart')

    // Step backwards
    const backFrame = replay.stepBackward()
    expect(backFrame?.stepIndex).toBe(1)
  })

  it('ContextExpirationManager runs periodic reaper and cleans expired items', async () => {
    const contextStore = new MemoryContextStore()
    const knowledgeStore = new KnowledgeStore()
    const expiration = new ContextExpirationManager(contextStore, knowledgeStore)

    const prov = createProvenance('planner')

    // Set cache item with 0.05 second TTL (50ms)
    knowledgeStore.setCache('expire-soon', { temp: true }, prov, 0.05)
    expect(knowledgeStore.getCache('expire-soon')).toBeDefined()

    // Wait 70ms
    await new Promise((r) => setTimeout(r, 70))

    const result = expiration.runReaper()
    expect(result.expiredCacheEntries).toBeGreaterThanOrEqual(1)
    expect(knowledgeStore.getCache('expire-soon')).toBeUndefined()
  })
})
