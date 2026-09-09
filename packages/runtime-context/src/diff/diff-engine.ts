import type { ContextSnapshot } from '../core/types'
import type { ContextDiff, SliceDiff, ValueDiff } from './types'

export class ContextDiffEngine {
  /**
   * Deterministically compare two ContextSnapshots and produce a structured diff.
   */
  static diff(snapshotA: ContextSnapshot, snapshotB: ContextSnapshot): ContextDiff {
    const summary: string[] = []
    const topAdded: Record<string, unknown> = {}
    const topRemoved: Record<string, unknown> = {}
    const topModified: Record<string, ValueDiff> = {}

    // Slices
    const browserDiff = ContextDiffEngine.diffObject(
      snapshotA.state.browser as unknown as Record<string, unknown>,
      snapshotB.state.browser as unknown as Record<string, unknown>,
      'browser',
      ['lastUpdated']
    )

    const desktopDiff = ContextDiffEngine.diffObject(
      snapshotA.state.desktop as unknown as Record<string, unknown>,
      snapshotB.state.desktop as unknown as Record<string, unknown>,
      'desktop',
      ['lastUpdated']
    )

    const filesystemDiff = ContextDiffEngine.diffObject(
      snapshotA.state.filesystem as unknown as Record<string, unknown>,
      snapshotB.state.filesystem as unknown as Record<string, unknown>,
      'filesystem',
      ['lastUpdated']
    )

    const customEntriesDiff = ContextDiffEngine.diffObject(
      snapshotA.state.customEntries as Record<string, unknown>,
      snapshotB.state.customEntries as Record<string, unknown>,
      'customEntries'
    )

    // Aggregate into top-level diff collections
    const slicePairs: [string, SliceDiff][] = [
      ['browser', browserDiff],
      ['desktop', desktopDiff],
      ['filesystem', filesystemDiff],
      ['customEntries', customEntriesDiff],
    ]

    for (const [sliceName, sDiff] of slicePairs) {
      for (const [k, v] of Object.entries(sDiff.added)) {
        const fullKey = `${sliceName}.${k}`
        topAdded[fullKey] = v
        summary.push(`Added ${fullKey}: ${JSON.stringify(v)}`)
      }
      for (const [k, v] of Object.entries(sDiff.removed)) {
        const fullKey = `${sliceName}.${k}`
        topRemoved[fullKey] = v
        summary.push(`Removed ${fullKey} (was: ${JSON.stringify(v)})`)
      }
      for (const [k, v] of Object.entries(sDiff.modified)) {
        const fullKey = `${sliceName}.${k}`
        topModified[fullKey] = v
        summary.push(`Modified ${fullKey}: ${JSON.stringify(v.before)} -> ${JSON.stringify(v.after)}`)
      }
    }

    const hasChanges =
      Object.keys(topAdded).length > 0 ||
      Object.keys(topRemoved).length > 0 ||
      Object.keys(topModified).length > 0

    return {
      snapshotAId: snapshotA.snapshotId,
      snapshotBId: snapshotB.snapshotId,
      versionA: snapshotA.version,
      versionB: snapshotB.version,
      timestampA: snapshotA.timestamp,
      timestampB: snapshotB.timestamp,
      hasChanges,
      added: topAdded,
      removed: topRemoved,
      modified: topModified,
      slices: {
        browser: browserDiff,
        desktop: desktopDiff,
        filesystem: filesystemDiff,
        customEntries: customEntriesDiff,
      },
      summary,
    }
  }

  private static diffObject(
    objA: Record<string, unknown> = {},
    objB: Record<string, unknown> = {},
    sliceName: string,
    ignoredKeys: string[] = []
  ): SliceDiff {
    const added: Record<string, unknown> = {}
    const removed: Record<string, unknown> = {}
    const modified: Record<string, ValueDiff> = {}
    const unchanged: string[] = []

    const allKeys = new Set([...Object.keys(objA), ...Object.keys(objB)])
    for (const key of ignoredKeys) {
      allKeys.delete(key)
    }

    for (const key of allKeys) {
      const valA = objA[key]
      const valB = objB[key]

      if (valA === undefined && valB !== undefined) {
        added[key] = valB
      } else if (valA !== undefined && valB === undefined) {
        removed[key] = valA
      } else if (!ContextDiffEngine.isEqual(valA, valB)) {
        modified[key] = { before: valA, after: valB }
      } else {
        unchanged.push(key)
      }
    }

    return { added, removed, modified, unchanged }
  }

  private static isEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
      return false
    }
    return JSON.stringify(a) === JSON.stringify(b)
  }
}
