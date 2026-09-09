import type { RuntimeIndexEngine } from '../../index/runtime-index'
import type { IndexDocument, IndexedEntityType } from '../../index/types'
import type { ContextInvalidationEngine } from '../../invalidation/invalidation-engine'
import type {
  InvalidationEvent,
  InvalidationOptions,
  InvalidationReason,
  InvalidationScope,
  InvalidationSubscriber,
} from '../../invalidation/types'
import type { RuntimeStorageTierManager } from '../../tiering/storage-manager'
import type { TieredStorageMetrics, TierPruneOptions, TierPruneResult } from '../../tiering/types'

export class StorageDomain {
  private tierManager: RuntimeStorageTierManager
  private invalidationEngine: ContextInvalidationEngine
  private indexEngine: RuntimeIndexEngine

  constructor(
    tierManager: RuntimeStorageTierManager,
    invalidationEngine: ContextInvalidationEngine,
    indexEngine: RuntimeIndexEngine
  ) {
    this.tierManager = tierManager
    this.invalidationEngine = invalidationEngine
    this.indexEngine = indexEngine
  }

  // --- Tiering & Metrics ---

  getMetrics(): TieredStorageMetrics {
    return this.tierManager.getMetrics()
  }

  prune(options: TierPruneOptions): TierPruneResult {
    return this.tierManager.prune(options)
  }

  // --- Runtime Index ---

  index(document: IndexDocument): void {
    this.indexEngine.index(document)
  }

  getIndex(id: string): IndexDocument | undefined {
    return this.indexEngine.get(id)
  }

  removeIndex(id: string): boolean {
    return this.indexEngine.remove(id)
  }

  removeIndexByUri(uri: string): number {
    return this.indexEngine.removeByUri(uri)
  }

  countIndex(entityType?: IndexedEntityType): number {
    return this.indexEngine.count(entityType)
  }

  // --- Context Invalidation ---

  invalidate(
    reason: InvalidationReason,
    scope: InvalidationScope,
    options?: InvalidationOptions
  ): InvalidationEvent {
    return this.invalidationEngine.invalidate(reason, scope, options)
  }

  invalidateUserLogout(domain?: string): InvalidationEvent {
    return this.invalidationEngine.invalidateUserLogout(domain)
  }

  invalidateWebsiteRedesign(domain: string): InvalidationEvent {
    return this.invalidationEngine.invalidateWebsiteRedesign(domain)
  }

  invalidateFileDeleted(filePath: string): InvalidationEvent {
    return this.invalidationEngine.invalidateFileDeleted(filePath)
  }

  invalidateWindowClosed(windowTitle: string): InvalidationEvent {
    return this.invalidationEngine.invalidateWindowClosed(windowTitle)
  }

  invalidatePermissionRevoked(permissionId: string): InvalidationEvent {
    return this.invalidationEngine.invalidatePermissionRevoked(permissionId)
  }

  onInvalidation(subscriber: InvalidationSubscriber): () => void {
    return this.invalidationEngine.onInvalidation(subscriber)
  }

  getInvalidationHistory(): InvalidationEvent[] {
    return this.invalidationEngine.getHistory()
  }
}
