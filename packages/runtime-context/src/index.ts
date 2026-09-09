// @usepilot/runtime-context — Public API

// 1. Core & Provenance
export {
  createProvenance,
  type ContextProvenance,
  type ProvenanceSource,
} from './core/provenance'

export { RuntimeContext } from './core/context'
export { MemoryContextStore, type IContextStore } from './core/store'
export {
  CURRENT_CONTEXT_SCHEMA_VERSION,
  type RuntimeContextState,
  type BrowserRuntimeState,
  type DesktopRuntimeState,
  type FilesystemRuntimeState,
  type ContextSnapshot,
  type ContextTransactionOptions,
  type StateMutationFn,
} from './core/types'

// 2. Observations
export {
  ObservationEngine,
  type ObservationSubscriber,
} from './observations/observation-engine'

export type {
  Observation,
  ObservationType,
  BaseObservation,
  BrowserObservation,
  FilesystemObservation,
  DesktopObservation,
  VisionObservation,
  VerificationObservation,
  VisionTextElement,
  InteractiveElementDescriptor,
  ObservationFilter,
} from './observations/types'

// 3. KnowledgeStore & Browser Knowledge Graph
export { KnowledgeStore, type KnowledgeStoreOptions } from './knowledge/knowledge-store'
export { BrowserKnowledgeGraph } from './knowledge/browser-graph'
export type {
  KnowledgeItem,
  KnowledgeCategory,
  KnowledgeRetentionPolicy,
  BrowserPageNode,
  DomainKnowledgeGraph,
  FormFieldDescriptor,
  PageActionDescriptor,
} from './knowledge/types'

// 4. Runtime Index
export { RuntimeIndexEngine } from './index/runtime-index'
export type {
  IndexDocument,
  IndexedEntityType,
  SearchQuery,
  SearchResult,
} from './index/types'

// 5. Execution Memory
export { ExecutionMemoryStore } from './memory/execution-memory'
export type {
  ExecutionMemoryRecord,
  ExecutionMemoryQuery,
} from './memory/types'

// 6. Unified Runtime Query API
export {
  RuntimeQueryEngine,
  type QueryEngineDependencies,
} from './retrieval/query-engine'

export type {
  MultiDomainQuery,
  RuntimeContextBundle,
} from './retrieval/types'

// 7. Context Expiration
export {
  ContextExpirationManager,
  DEFAULT_RETENTION_RULES,
  type RetentionTier,
  type RetentionPolicyRule,
} from './expiration/expiration-manager'

// 8. Observation Replay
export {
  ObservationReplayEngine,
  type ReplayStateSnapshot,
} from './replay/observation-replay'

// 9. Runtime Entity Graph
export { RuntimeEntityGraph } from './graph/entity-graph'
export type {
  EntityType,
  RelationshipType,
  GraphEntity,
  GraphRelationship,
  EntityGraphQuery,
} from './graph/types'

// 10. Runtime Health Telemetry
export { RuntimeContextHealthMonitor, type HealthMonitorDependencies } from './health/health-monitor'
export type {
  RuntimeContextHealthReport,
  SubsystemHealthReport,
  SubsystemHealthStatus,
} from './health/types'

// 11. Context Invalidation
export {
  ContextInvalidationEngine,
  type InvalidationEngineDependencies,
} from './invalidation/invalidation-engine'
export type {
  InvalidationReason,
  InvalidationScope,
  InvalidationEvent,
  InvalidationSubscriber,
  InvalidationOptions,
} from './invalidation/types'

// 12. Context Diff
export { ContextDiffEngine } from './diff/diff-engine'
export type {
  ValueDiff,
  SliceDiff,
  ContextDiff,
} from './diff/types'

// 13. Hot / Warm / Cold Storage Tiering
export { RuntimeStorageTierManager, type StorageTierDependencies } from './tiering/storage-manager'
export type {
  StorageTier,
  TieredStorageMetrics,
  TierPruneOptions,
  TierPruneResult,
} from './tiering/types'

// 14. Primary Facade & Factory (Recommended External Entry Point)
export { RuntimeContextFacade, type RuntimeContextFacadeDependencies } from './facade/facade'
export {
  createRuntimeContextFacade,
  type RuntimeContextConfig,
  type RuntimeContextDependencies,
} from './facade/factory'
export {
  ContextTransactionRunner,
  type ContextTransactionScope,
} from './facade/transaction'
export { QueryDomain } from './facade/domains/query.domain'
export { ObservationsDomain } from './facade/domains/observations.domain'
export { KnowledgeDomain } from './facade/domains/knowledge.domain'
export { EntitiesDomain } from './facade/domains/entities.domain'
export { StorageDomain } from './facade/domains/storage.domain'
export { ReplayDomain } from './facade/domains/replay.domain'
export { StateDomain } from './facade/domains/state.domain'


