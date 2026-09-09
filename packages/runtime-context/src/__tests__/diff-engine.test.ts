import { describe, expect, it } from 'vitest'
import type { ContextSnapshot } from '../core/types'
import { ContextDiffEngine } from '../diff/diff-engine'

describe('ContextDiffEngine', () => {
  const baseSnapshot: ContextSnapshot = {
    snapshotId: 'snap-1',
    sessionId: 'sess-test',
    version: 1,
    timestamp: 1000,
    checksum: 'sha-base',
    state: {
      sessionId: 'sess-test',
      version: 1,
      createdAt: 1000,
      updatedAt: 1000,
      browser: {
        currentUrl: 'https://amazon.in',
        pageTitle: 'Amazon',
        activeDomain: 'amazon.in',
        authenticatedDomains: ['amazon.in'],
        tabCount: 1,
        lastUpdated: 1000,
      },
      desktop: {
        activeWindowTitle: 'Code Editor',
        focusedProcessId: 1234,
        clipboardPreview: 'test-clipboard',
        lastUpdated: 1000,
      },
      filesystem: {
        currentWorkingDirectory: 'E:/usePilot',
        activeDownloads: [],
        recentPaths: ['E:/usePilot/README.md'],
        lastUpdated: 1000,
      },
      customEntries: {},
    },
  }

  it('detects zero changes between identical snapshots', () => {
    const diff = ContextDiffEngine.diff(baseSnapshot, { ...baseSnapshot, snapshotId: 'snap-2' })
    expect(diff.hasChanges).toBe(false)
    expect(Object.keys(diff.added).length).toBe(0)
    expect(Object.keys(diff.removed).length).toBe(0)
    expect(Object.keys(diff.modified).length).toBe(0)
    expect(diff.summary.length).toBe(0)
  })

  it('detects modifications across browser, desktop, and filesystem slices', () => {
    const updatedSnapshot: ContextSnapshot = {
      ...baseSnapshot,
      snapshotId: 'snap-2',
      version: 2,
      timestamp: 2000,
      state: {
        ...baseSnapshot.state,
        version: 2,
        updatedAt: 2000,
        browser: {
          ...baseSnapshot.state.browser,
          currentUrl: 'https://amazon.in/gp/your-account/order-history',
          pageTitle: 'Your Orders',
          tabCount: 2,
        },
        desktop: {
          ...baseSnapshot.state.desktop,
          activeWindowTitle: 'Downloads Window',
        },
        filesystem: {
          ...baseSnapshot.state.filesystem,
          activeDownloads: ['invoice.pdf'],
        },
      },
    }

    const diff = ContextDiffEngine.diff(baseSnapshot, updatedSnapshot)

    expect(diff.hasChanges).toBe(true)
    expect(diff.versionA).toBe(1)
    expect(diff.versionB).toBe(2)

    // Browser slice modifications
    expect(diff.slices.browser.modified['currentUrl']?.before).toBe('https://amazon.in')
    expect(diff.slices.browser.modified['currentUrl']?.after).toBe('https://amazon.in/gp/your-account/order-history')
    expect(diff.slices.browser.modified['pageTitle']?.after).toBe('Your Orders')
    expect(diff.slices.browser.modified['tabCount']?.after).toBe(2)

    // Desktop slice modifications
    expect(diff.slices.desktop.modified['activeWindowTitle']?.before).toBe('Code Editor')
    expect(diff.slices.desktop.modified['activeWindowTitle']?.after).toBe('Downloads Window')

    // Filesystem slice modifications
    expect(diff.slices.filesystem.modified['activeDownloads']?.after).toEqual(['invoice.pdf'])

    // Top-level aggregation
    expect(diff.modified['browser.currentUrl']).toBeDefined()
    expect(diff.modified['desktop.activeWindowTitle']).toBeDefined()
    expect(diff.summary.length).toBeGreaterThan(0)
  })
})
