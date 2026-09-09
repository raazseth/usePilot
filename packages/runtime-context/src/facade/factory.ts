import { MemoryContextStore } from '../core/store'
import { RuntimeEntityGraph } from '../graph/entity-graph'
import { RuntimeIndexEngine } from '../index/runtime-index'
import { ContextInvalidationEngine } from '../invalidation/invalidation-engine'
import { KnowledgeStore } from '../knowledge/knowledge-store'
import { ExecutionMemoryStore } from '../memory/execution-memory'
import { ObservationEngine } from '../observations/observation-engine'
import { ObservationReplayEngine } from '../replay/observation-replay'
import { RuntimeQueryEngine } from '../retrieval/query-engine'
import { RuntimeStorageTierManager } from '../tiering/storage-manager'

import { EntitiesDomain } from './domains/entities.domain'
import { KnowledgeDomain } from './domains/knowledge.domain'
import { ObservationsDomain } from './domains/observations.domain'
import { QueryDomain } from './domains/query.domain'
import { ReplayDomain } from './domains/replay.domain'
import { StateDomain } from './domains/state.domain'
import { StorageDomain } from './domains/storage.domain'
import { RuntimeContextFacade } from './facade'

export interface RuntimeContextDependencies {
  contextStore?: MemoryContextStore | undefined
  observationEngine?: ObservationEngine | undefined
  knowledgeStore?: KnowledgeStore | undefined
  runtimeIndex?: RuntimeIndexEngine | undefined
  executionMemory?: ExecutionMemoryStore | undefined
  entityGraph?: RuntimeEntityGraph | undefined
  replayEngine?: ObservationReplayEngine | undefined
}

export interface RuntimeContextConfig {
  maxStoredObservations?: number | undefined
  maxCacheEntries?: number | undefined
  dependencies?: RuntimeContextDependencies | undefined
}

/**
 * Factory function creating an isolated RuntimeContextFacade instance with optional dependency injection.
 * Eliminates global singleton state and enables clean multi-workspace / testing environments.
 */
export function createRuntimeContextFacade(
  configOrDeps?: RuntimeContextConfig | RuntimeContextDependencies
): RuntimeContextFacade {
  // Normalize options vs direct dependencies
  let config: RuntimeContextConfig = {}
  let customDeps: RuntimeContextDependencies = {}

  if (configOrDeps) {
    if ('dependencies' in configOrDeps) {
      config = configOrDeps
      customDeps = configOrDeps.dependencies ?? {}
    } else if (
      'contextStore' in configOrDeps ||
      'observationEngine' in configOrDeps ||
      'knowledgeStore' in configOrDeps ||
      'runtimeIndex' in configOrDeps ||
      'executionMemory' in configOrDeps ||
      'entityGraph' in configOrDeps ||
      'replayEngine' in configOrDeps
    ) {
      customDeps = configOrDeps
    } else {
      config = configOrDeps as RuntimeContextConfig
    }
  }

  // 1. Core internal stores & engines (use injected dependencies or construct defaults)
  const contextStore = customDeps.contextStore ?? new MemoryContextStore()
  const observationEngine =
    customDeps.observationEngine ?? new ObservationEngine(config.maxStoredObservations ?? 2000)
  const knowledgeStore =
    customDeps.knowledgeStore ?? new KnowledgeStore({ maxCacheEntries: config.maxCacheEntries ?? 1000 })
  const runtimeIndex = customDeps.runtimeIndex ?? new RuntimeIndexEngine()
  const executionMemory = customDeps.executionMemory ?? new ExecutionMemoryStore()
  const entityGraph = customDeps.entityGraph ?? new RuntimeEntityGraph()
  const replayEngine = customDeps.replayEngine ?? new ObservationReplayEngine()

  // 2. High-level query & invalidation & tiering engines
  const queryEngine = new RuntimeQueryEngine({
    contextStore,
    observationEngine,
    knowledgeStore,
    indexEngine: runtimeIndex,
    executionMemory,
    entityGraph,
  })

  const invalidationEngine = new ContextInvalidationEngine({
    knowledgeStore,
    observationEngine,
    runtimeIndex,
    entityGraph,
    contextStore,
  })

  const tierManager = new RuntimeStorageTierManager({
    contextStore,
    observationEngine,
    knowledgeStore,
    runtimeIndex,
    entityGraph,
    executionMemory,
    replayEngine,
  })

  // 3. Domain namespaces
  const query = new QueryDomain(queryEngine)
  const observations = new ObservationsDomain(observationEngine)
  const knowledge = new KnowledgeDomain(knowledgeStore)
  const entities = new EntitiesDomain(entityGraph)
  const storage = new StorageDomain(tierManager, invalidationEngine, runtimeIndex)
  const replay = new ReplayDomain()
  const state = new StateDomain(contextStore)

  // 4. Unified facade
  return new RuntimeContextFacade({
    query,
    observations,
    knowledge,
    entities,
    storage,
    replay,
    state,
  })
}
