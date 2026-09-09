// @usepilot/runtime-context — Public API

// 1. Core & Provenance
export {
  createProvenance,
  type ContextProvenance,
  type ProvenanceSource,
} from './core/provenance'

export { RuntimeContext } from './core/context'
export { MemoryContextStore, type IContextStore } from './core/store'
export type {
  RuntimeContextState,
  BrowserRuntimeState,
  DesktopRuntimeState,
  FilesystemRuntimeState,
  ContextSnapshot,
  ContextTransactionOptions,
  StateMutationFn,
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
