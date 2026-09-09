import type { MemoryContextStore } from '../core/store'
import type { RuntimeEntityGraph } from '../graph/entity-graph'
import type { RuntimeIndexEngine } from '../index/runtime-index'
import type { KnowledgeStore } from '../knowledge/knowledge-store'
import type { ObservationEngine } from '../observations/observation-engine'
import type {
  InvalidationEvent,
  InvalidationOptions,
  InvalidationReason,
  InvalidationScope,
  InvalidationSubscriber,
} from './types'

export interface InvalidationEngineDependencies {
  knowledgeStore: KnowledgeStore
  observationEngine: ObservationEngine
  runtimeIndex: RuntimeIndexEngine
  entityGraph: RuntimeEntityGraph
  contextStore?: MemoryContextStore | undefined
}

export class ContextInvalidationEngine {
  private static instance: ContextInvalidationEngine | null = null
  private deps: InvalidationEngineDependencies
  private subscribers = new Set<InvalidationSubscriber>()
  private history: InvalidationEvent[] = []
  private maxHistory = 100

  constructor(deps: InvalidationEngineDependencies) {
    this.deps = deps
  }

  static getInstance(deps?: InvalidationEngineDependencies): ContextInvalidationEngine {
    if (!ContextInvalidationEngine.instance) {
      if (!deps) {
        throw new Error('ContextInvalidationEngine requires dependencies on initial instantiation')
      }
      ContextInvalidationEngine.instance = new ContextInvalidationEngine(deps)
    }
    return ContextInvalidationEngine.instance
  }

  onInvalidation(subscriber: InvalidationSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  getHistory(): InvalidationEvent[] {
    return [...this.history]
  }

  /**
   * Unified invalidation dispatcher for deterministic context pruning
   */
  invalidate(
    reason: InvalidationReason,
    scope: InvalidationScope,
    options?: InvalidationOptions
  ): InvalidationEvent {
    const target = options?.target
    let observationsPurged = 0
    let indexDocsPurged = 0
    let graphNodesPurged = 0
    let entitiesPurged = 0
    let relationshipsPurged = 0

    const countsBefore = this.deps.entityGraph.count()

    // 1. Browser Graph Invalidation
    if (scope === 'browser' || scope === 'all') {
      const bg = this.deps.knowledgeStore.getBrowserGraph()
      if (target) {
        if (bg.getDomainGraph(target)) {
          bg.invalidateDomain(target)
          graphNodesPurged++
        }
      } else {
        const domains = bg.listDomains()
        for (const d of domains) {
          bg.invalidateDomain(d)
          graphNodesPurged++
        }
      }
    }

    // 2. Observations Purge
    if (scope === 'observations' || scope === 'all') {
      if (target) {
        observationsPurged = this.deps.observationEngine.purge((obs) => {
          if (obs.type === 'browser_state') {
            return obs.payload.domain === target || obs.payload.currentUrl.includes(target)
          }
          if (obs.type === 'filesystem_state') {
            return obs.payload.targetPath === target || obs.payload.targetPath.includes(target)
          }
          if (obs.type === 'desktop_state') {
            return obs.payload.activeWindowTitle?.includes(target) ?? false
          }
          return false
        })
      } else {
        const total = this.deps.observationEngine.query().length
        this.deps.observationEngine.clear()
        observationsPurged = total
      }
    }

    // 3. Runtime Index Purge
    if (scope === 'index' || scope === 'all') {
      if (target) {
        indexDocsPurged = this.deps.runtimeIndex.purge((doc) => {
          return (
            doc.id === target ||
            doc.uri === target ||
            (doc.uri ? doc.uri.includes(target) : false) ||
            doc.title.includes(target)
          )
        })
      } else {
        const total = this.deps.runtimeIndex.count()
        this.deps.runtimeIndex.clear()
        indexDocsPurged = total
      }
    }

    // 4. Entity Graph Purge
    if (scope === 'entities' || scope === 'all') {
      if (target) {
        const removed = this.deps.entityGraph.removeEntity(target)
        if (removed) {
          entitiesPurged++
        } else {
          // If target is a name or query, search matching entities
          const matched = this.deps.entityGraph.query({}).entities.filter(
            (e) => e.name === target || e.label === target || (e.properties?.['path'] === target)
          )
          for (const m of matched) {
            if (this.deps.entityGraph.removeEntity(m.id)) {
              entitiesPurged++
            }
          }
        }
      } else {
        const counts = this.deps.entityGraph.count()
        this.deps.entityGraph.clear()
        entitiesPurged = counts.entities
      }
    }

    const countsAfter = this.deps.entityGraph.count()
    relationshipsPurged = Math.max(0, countsBefore.relationships - countsAfter.relationships)

    // Construct event
    const event: InvalidationEvent = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      reason,
      scope,
      target,
      invalidatedCount: {
        observations: observationsPurged,
        indexDocuments: indexDocsPurged,
        graphNodes: graphNodesPurged,
        entities: entitiesPurged,
        relationships: relationshipsPurged,
      },
    }
    if (options?.metadata) event.metadata = options.metadata

    // Store in history
    this.history.unshift(event)
    if (this.history.length > this.maxHistory) {
      this.history.pop()
    }

    // Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(event)
      } catch (err) {
        console.error('[ContextInvalidationEngine] Subscriber error:', err)
      }
    }

    return event
  }

  // --- Specialized Invalidation Operations ---

  invalidateUserLogout(domain?: string): InvalidationEvent {
    if (domain) {
      this.deps.knowledgeStore.getBrowserGraph().setAuthentication(domain, false)
      return this.invalidate('user_logout', 'all', { target: domain })
    }
    return this.invalidate('user_logout', 'all')
  }

  invalidateWebsiteRedesign(domain: string): InvalidationEvent {
    return this.invalidate('website_redesign', 'all', { target: domain })
  }

  invalidateFileDeleted(filePath: string): InvalidationEvent {
    return this.invalidate('file_deleted', 'all', { target: filePath })
  }

  invalidateWindowClosed(windowTitle: string): InvalidationEvent {
    return this.invalidate('window_closed', 'all', { target: windowTitle })
  }

  invalidatePermissionRevoked(permissionId: string): InvalidationEvent {
    return this.invalidate('permission_revoked', 'entities', { target: permissionId })
  }
}
