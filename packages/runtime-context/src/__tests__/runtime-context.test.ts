import { describe, it, expect } from 'vitest'

import { RuntimeContext } from '../core/context'
import { createProvenance } from '../core/provenance'
import { MemoryContextStore } from '../core/store'

describe('RuntimeContext & Provenance (Deliverable 1 & Requirement 4)', () => {
  it('initializes default state and tracks provenance', () => {
    const ctx = new RuntimeContext('session-100', '/workspace/app')
    const state = ctx.getState()

    expect(state.sessionId).toBe('session-100')
    expect(state.version).toBe(1)
    expect(state.filesystem.currentWorkingDirectory).toBe('/workspace/app')

    const prov = createProvenance('browser', {
      confidence: 0.95,
      url: 'https://example.com/login',
      adapter: 'PlaywrightBrowserAdapter',
    })
    expect(prov.source).toBe('browser')
    expect(prov.confidence).toBe(0.95)
    expect(prov.url).toBe('https://example.com/login')

    ctx.setBrowserState(
      { currentUrl: 'https://example.com/login', pageTitle: 'Login Page' },
      prov
    )

    const updated = ctx.getState()
    expect(updated.version).toBe(2)
    expect(updated.browser.currentUrl).toBe('https://example.com/login')
    expect(updated.browser.pageTitle).toBe('Login Page')
  })

  it('performs atomic mutations and snapshotting with rollback', async () => {
    const ctx = new RuntimeContext('session-200')
    const snap1 = ctx.createSnapshot()
    expect(snap1.version).toBe(1)

    await ctx.mutate((draft) => {
      draft.desktop.activeWindowTitle = 'VS Code'
      draft.filesystem.activeDownloads.push('invoice.pdf')
    })

    const stateAfterMutate = ctx.getState()
    expect(stateAfterMutate.version).toBe(2)
    expect(stateAfterMutate.desktop.activeWindowTitle).toBe('VS Code')
    expect(stateAfterMutate.filesystem.activeDownloads).toContain('invoice.pdf')

    // Rollback to snap1
    const success = ctx.rollbackToSnapshot(snap1.snapshotId)
    expect(success).toBe(true)

    const stateAfterRollback = ctx.getState()
    // Version increases monotonically to ensure auditability
    expect(stateAfterRollback.version).toBe(3)
    expect(stateAfterRollback.desktop.activeWindowTitle).toBeUndefined()
    expect(stateAfterRollback.filesystem.activeDownloads.length).toBe(0)
  })

  it('MemoryContextStore manages contexts and snapshots', async () => {
    const store = new MemoryContextStore()
    const ctx = store.getOrCreate('session-300')
    expect(ctx.getSessionId()).toBe('session-300')

    const snap = ctx.createSnapshot()
    await store.saveSnapshot(snap)

    const snapshots = await store.listSnapshots('session-300')
    expect(snapshots.length).toBe(1)
    expect(snapshots[0]?.checksum).toBeDefined()

    await store.deleteSession('session-300')
    expect(store.get('session-300')).toBeUndefined()
  })
})
