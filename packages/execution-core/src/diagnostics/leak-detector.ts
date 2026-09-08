import type { ResourceLeakWarning, TrackedResourceType } from './health-types'

export interface TrackedResourceRecord {
  id: string
  type: TrackedResourceType
  allocatedAt: number
  allocatedBy: string
  disposeHandler?: () => Promise<void> | void
}

export class ResourceLeakDetector {
  private static instance: ResourceLeakDetector | null = null
  private resources = new Map<string, TrackedResourceRecord>()

  static getInstance(): ResourceLeakDetector {
    if (!ResourceLeakDetector.instance) {
      ResourceLeakDetector.instance = new ResourceLeakDetector()
    }
    return ResourceLeakDetector.instance
  }

  track(
    id: string,
    type: TrackedResourceType,
    allocatedBy: string,
    disposeHandler?: (() => Promise<void> | void) | undefined
  ): void {
    const record: TrackedResourceRecord = {
      id,
      type,
      allocatedAt: Date.now(),
      allocatedBy,
    }
    if (disposeHandler !== undefined) {
      record.disposeHandler = disposeHandler
    }
    this.resources.set(id, record)
  }

  release(id: string): boolean {
    return this.resources.delete(id)
  }

  getActiveCount(type?: TrackedResourceType): number {
    if (!type) return this.resources.size
    let count = 0
    for (const r of this.resources.values()) {
      if (r.type === type) count++
    }
    return count
  }

  detectLeaks(maxAgeSeconds = 30): ResourceLeakWarning[] {
    const now = Date.now()
    const warnings: ResourceLeakWarning[] = []

    for (const r of this.resources.values()) {
      const ageSeconds = Math.round((now - r.allocatedAt) / 1000)
      if (ageSeconds >= maxAgeSeconds) {
        warnings.push({
          resourceType: r.type,
          resourceId: r.id,
          allocatedAt: r.allocatedAt,
          allocatedBy: r.allocatedBy,
          ageSeconds,
          leakSeverity: ageSeconds > 120 ? 'high' : ageSeconds > 60 ? 'medium' : 'low',
        })
      }
    }

    return warnings
  }

  async cleanupAllLeakedResources(): Promise<number> {
    let cleaned = 0
    for (const [id, record] of Array.from(this.resources.entries())) {
      if (record.disposeHandler) {
        try {
          await record.disposeHandler()
          cleaned++
        } catch {
          // Best effort disposal
        }
      }
      this.resources.delete(id)
    }
    return cleaned
  }
}
