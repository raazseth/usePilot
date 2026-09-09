import type { QueryDomain } from './domains/query.domain'
import type { ObservationsDomain } from './domains/observations.domain'
import type { KnowledgeDomain } from './domains/knowledge.domain'
import type { EntitiesDomain } from './domains/entities.domain'
import type { StorageDomain } from './domains/storage.domain'
import type { ReplayDomain } from './domains/replay.domain'
import type { StateDomain } from './domains/state.domain'
import { ContextTransactionRunner, type ContextTransactionScope } from './transaction'

export interface RuntimeContextFacadeDependencies {
  query: QueryDomain
  observations: ObservationsDomain
  knowledge: KnowledgeDomain
  entities: EntitiesDomain
  storage: StorageDomain
  replay: ReplayDomain
  state: StateDomain
}

/**
 * RuntimeContextFacade — Unified Gateway to Runtime Context
 *
 * Encapsulates all underlying context subsystems:
 * - query: Read-only compilation, search, key lookup, health
 * - observations: Perception streaming, event filtering, purge, subscriptions
 * - knowledge: Topological browser graphs, page forms, persistent facts
 * - entities: Relational entity graph nodes, relationships, multi-hop traversals
 * - storage: Tiering metrics (Hot/Warm/Cold), pruning, deterministic invalidation
 * - replay: Deterministic historical state replay
 * - state: Hot state mutations, snapshots, and diffing
 */
export class RuntimeContextFacade {
  readonly query: QueryDomain
  readonly observations: ObservationsDomain
  readonly knowledge: KnowledgeDomain
  readonly entities: EntitiesDomain
  readonly storage: StorageDomain
  readonly replay: ReplayDomain
  readonly state: StateDomain
  private readonly transactionRunner: ContextTransactionRunner

  constructor(deps: RuntimeContextFacadeDependencies) {
    this.query = deps.query
    this.observations = deps.observations
    this.knowledge = deps.knowledge
    this.entities = deps.entities
    this.storage = deps.storage
    this.replay = deps.replay
    this.state = deps.state
    this.transactionRunner = new ContextTransactionRunner({
      state: deps.state,
      knowledge: deps.knowledge,
      entities: deps.entities,
      observations: deps.observations,
    })
  }

  /**
   * Atomic multi-subsystem transaction.
   * If any step fails, all mutations across state, knowledge, entities, and observations are rolled back.
   */
  async transaction<T>(action: (tx: ContextTransactionScope) => Promise<T> | T): Promise<T> {
    return this.transactionRunner.run(action)
  }
}
