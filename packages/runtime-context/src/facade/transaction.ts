import type { RuntimeContext } from '../core/context'
import type { ContextProvenance } from '../core/provenance'
import type { ContextSnapshot, StateMutationFn } from '../core/types'
import type { GraphEntity, GraphRelationship, RelationshipType } from '../graph/types'
import type { BrowserPageNode, KnowledgeItem } from '../knowledge/types'
import type { Observation } from '../observations/types'
import type { EntitiesDomain } from './domains/entities.domain'
import type { KnowledgeDomain } from './domains/knowledge.domain'
import type { ObservationsDomain } from './domains/observations.domain'
import type { StateDomain } from './domains/state.domain'

export interface ContextTransactionScope {
  state: {
    update(sessionId: string, mutation: StateMutationFn): Promise<ContextSnapshot>
    mutate(sessionId: string, mutation: StateMutationFn): Promise<ContextSnapshot>
  }
  knowledge: {
    add(domain: string, page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>): BrowserPageNode
    recordPage(domain: string, page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>): BrowserPageNode
    setPersistent<T>(key: string, data: T, provenance: ContextProvenance): KnowledgeItem<T>
  }
  entities: {
    add(entity: Omit<GraphEntity, 'createdAt' | 'updatedAt'>): GraphEntity
    link(
      sourceId: string,
      targetId: string,
      type: RelationshipType,
      properties?: Record<string, unknown>
    ): GraphRelationship
  }
  observations: {
    emit(observation: Observation, targetContext?: RuntimeContext): void
  }
}

export class ContextTransactionRunner {
  private stateDomain: StateDomain
  private knowledgeDomain: KnowledgeDomain
  private entitiesDomain: EntitiesDomain
  private observationsDomain: ObservationsDomain

  constructor(deps: {
    state: StateDomain
    knowledge: KnowledgeDomain
    entities: EntitiesDomain
    observations: ObservationsDomain
  }) {
    this.stateDomain = deps.state
    this.knowledgeDomain = deps.knowledge
    this.entitiesDomain = deps.entities
    this.observationsDomain = deps.observations
  }

  async run<T>(action: (tx: ContextTransactionScope) => Promise<T> | T): Promise<T> {
    // Rollback tracking logs
    const mutatedSessions = new Map<string, string>() // sessionId -> initialSnapshotId
    const addedEntities: string[] = []
    const addedRelationships: string[] = []
    const addedObservations: string[] = []
    const addedKnowledgeKeys: { category: 'persistent' | 'cache'; key: string }[] = []
    const addedPages: { domain: string; path: string }[] = []

    const tx: ContextTransactionScope = {
      state: {
        update: async (sessionId: string, mutation: StateMutationFn) => {
          if (!mutatedSessions.has(sessionId)) {
            const initialSnap = this.stateDomain.getSnapshot(sessionId)
            mutatedSessions.set(sessionId, initialSnap.snapshotId)
          }
          return this.stateDomain.mutate(sessionId, mutation)
        },
        mutate: async (sessionId: string, mutation: StateMutationFn) => {
          if (!mutatedSessions.has(sessionId)) {
            const initialSnap = this.stateDomain.getSnapshot(sessionId)
            mutatedSessions.set(sessionId, initialSnap.snapshotId)
          }
          return this.stateDomain.mutate(sessionId, mutation)
        },
      },
      knowledge: {
        add: (domain: string, page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>) => {
          const res = this.knowledgeDomain.recordPage(domain, page)
          addedPages.push({ domain, path: page.path })
          return res
        },
        recordPage: (domain: string, page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>) => {
          const res = this.knowledgeDomain.recordPage(domain, page)
          addedPages.push({ domain, path: page.path })
          return res
        },
        setPersistent: <V>(key: string, data: V, provenance: ContextProvenance) => {
          const item = this.knowledgeDomain.setPersistent(key, data, provenance)
          addedKnowledgeKeys.push({ category: 'persistent', key })
          return item
        },
      },
      entities: {
        add: (entity: Omit<GraphEntity, 'createdAt' | 'updatedAt'>) => {
          const ent = this.entitiesDomain.addEntity(entity)
          addedEntities.push(ent.id)
          return ent
        },
        link: (
          sourceId: string,
          targetId: string,
          type: RelationshipType,
          properties?: Record<string, unknown>
        ) => {
          const rel = this.entitiesDomain.addRelationship(sourceId, targetId, type, properties)
          addedRelationships.push(rel.id)
          return rel
        },
      },
      observations: {
        emit: (observation: Observation, targetContext?: RuntimeContext) => {
          addedObservations.push(observation.id)
          this.observationsDomain.emit(observation, targetContext)
        },
      },
    }

    try {
      return await action(tx)
    } catch (error) {
      // Automatic Multi-Subsystem Rollback
      // 1. Rollback hot state contexts
      for (const [sessionId, snapshotId] of mutatedSessions.entries()) {
        const context = this.stateDomain.get(sessionId)
        if (context) {
          context.rollbackToSnapshot(snapshotId)
        }
      }

      // 2. Rollback entities & relationships
      for (const relId of addedRelationships) {
        this.entitiesDomain.removeRelationship(relId)
      }
      for (const entId of addedEntities) {
        this.entitiesDomain.removeEntity(entId)
      }

      // 3. Rollback observations
      if (addedObservations.length > 0) {
        const idSet = new Set(addedObservations)
        this.observationsDomain.purge((obs) => idSet.has(obs.id))
      }

      // 4. Rollback knowledge pages
      for (const { domain, path } of addedPages) {
        const bg = this.knowledgeDomain.getBrowserGraph(domain)
        if (bg?.nodes[path]) {
          delete bg.nodes[path]
        }
      }

      throw new Error(`Context transaction aborted, rolled back all subsystem operations: ${(error as Error).message}`)
    }
  }
}
