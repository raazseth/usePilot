export interface ValueDiff<T = unknown> {
  before: T
  after: T
}

export interface SliceDiff {
  added: Record<string, unknown>
  removed: Record<string, unknown>
  modified: Record<string, ValueDiff>
  unchanged: string[]
}

export interface ContextDiff {
  snapshotAId: string
  snapshotBId: string
  versionA: number
  versionB: number
  timestampA: number
  timestampB: number
  hasChanges: boolean
  added: Record<string, unknown>
  removed: Record<string, unknown>
  modified: Record<string, ValueDiff>
  slices: {
    browser: SliceDiff
    desktop: SliceDiff
    filesystem: SliceDiff
    customEntries: SliceDiff
  }
  summary: string[]
}
