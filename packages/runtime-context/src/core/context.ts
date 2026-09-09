import { createHash } from 'node:crypto'

import { createProvenance } from './provenance'
import type { ContextProvenance } from './provenance'
import type {
  RuntimeContextState,
  ContextSnapshot,
  StateMutationFn,
} from './types'

export class RuntimeContext {
  private state: RuntimeContextState
  private snapshots: ContextSnapshot[] = []

  constructor(sessionId: string, initialCwd: string = process.cwd()) {
    const now = Date.now()
    this.state = {
      sessionId,
      version: 1,
      browser: {
        authenticatedDomains: [],
        tabCount: 0,
        lastUpdated: now,
      },
      desktop: {
        lastUpdated: now,
      },
      filesystem: {
        currentWorkingDirectory: initialCwd,
        activeDownloads: [],
        recentPaths: [],
        lastUpdated: now,
      },
      customEntries: {},
      createdAt: now,
      updatedAt: now,
    }
  }

  getSessionId(): string {
    return this.state.sessionId
  }

  getVersion(): number {
    return this.state.version
  }

  getState(): Readonly<RuntimeContextState> {
    return JSON.parse(JSON.stringify(this.state)) as RuntimeContextState
  }

  // Atomic state transaction with rollback capability
  async mutate(mutation: StateMutationFn): Promise<ContextSnapshot> {
    const draft: RuntimeContextState = JSON.parse(JSON.stringify(this.state)) as RuntimeContextState
    draft.version += 1
    draft.updatedAt = Date.now()

    try {
      await mutation(draft)
      this.state = draft
      const snapshot = this.createSnapshot()
      return snapshot
    } catch (error) {
      // Automatic rollback on exception
      throw new Error(`Context mutation failed, state preserved at version ${this.state.version}: ${(error as Error).message}`)
    }
  }

  setBrowserState(
    update: Partial<Omit<RuntimeContextState['browser'], 'lastUpdated'>>,
    provenance?: ContextProvenance
  ): void {
    const now = Date.now()
    const prov = provenance ?? createProvenance('browser', { timestamp: now })
    this.state.browser = {
      ...this.state.browser,
      ...update,
      lastUpdated: now,
    }
    this.state.customEntries['internal:browser_prov'] = { value: prov, provenance: prov }
    this.state.version += 1
    this.state.updatedAt = now
  }

  setDesktopState(
    update: Partial<Omit<RuntimeContextState['desktop'], 'lastUpdated'>>,
    provenance?: ContextProvenance
  ): void {
    const now = Date.now()
    const prov = provenance ?? createProvenance('desktop', { timestamp: now })
    this.state.desktop = {
      ...this.state.desktop,
      ...update,
      lastUpdated: now,
    }
    this.state.customEntries['internal:desktop_prov'] = { value: prov, provenance: prov }
    this.state.version += 1
    this.state.updatedAt = now
  }

  setFilesystemState(
    update: Partial<Omit<RuntimeContextState['filesystem'], 'lastUpdated'>>,
    provenance?: ContextProvenance
  ): void {
    const now = Date.now()
    const prov = provenance ?? createProvenance('filesystem', { timestamp: now })
    this.state.filesystem = {
      ...this.state.filesystem,
      ...update,
      lastUpdated: now,
    }
    this.state.customEntries['internal:filesystem_prov'] = { value: prov, provenance: prov }
    this.state.version += 1
    this.state.updatedAt = now
  }

  setCustomEntry(key: string, value: unknown, provenance: ContextProvenance): void {
    this.state.customEntries[key] = { value, provenance }
    this.state.version += 1
    this.state.updatedAt = Date.now()
  }

  getCustomEntry<T = unknown>(key: string): { value: T; provenance: ContextProvenance } | undefined {
    const entry = this.state.customEntries[key]
    if (!entry) return undefined
    return entry as { value: T; provenance: ContextProvenance }
  }

  createSnapshot(): ContextSnapshot {
    const now = Date.now()
    const serialized = JSON.stringify(this.state)
    const checksum = createHash('sha256').update(serialized).digest('hex')
    const snapshot: ContextSnapshot = {
      snapshotId: `snap-${this.state.sessionId}-v${this.state.version}-${now}`,
      sessionId: this.state.sessionId,
      version: this.state.version,
      state: JSON.parse(serialized) as RuntimeContextState,
      timestamp: now,
      checksum,
    }
    this.snapshots.push(snapshot)
    return snapshot
  }

  getSnapshots(): ContextSnapshot[] {
    return [...this.snapshots]
  }

  getLatestSnapshot(): ContextSnapshot | undefined {
    return this.snapshots[this.snapshots.length - 1]
  }

  rollbackToSnapshot(snapshotId: string): boolean {
    const target = this.snapshots.find((s) => s.snapshotId === snapshotId)
    if (!target) return false

    // Deep copy restored state and increment version to guarantee monotonically increasing versioning
    const restored: RuntimeContextState = JSON.parse(JSON.stringify(target.state)) as RuntimeContextState
    restored.version = this.state.version + 1
    restored.updatedAt = Date.now()
    this.state = restored
    this.createSnapshot()
    return true
  }
}
