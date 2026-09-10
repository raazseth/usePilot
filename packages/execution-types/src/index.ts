// @usepilot/execution-types — Public API

export type {
  ExecutionStatus,
  TaskExecutionStatus,
  FailureCategory,
  ExecutionRun,
  ExecutionTask,
  TaskSummary,
  ExecutionReport,
  ExecutionResult,
} from './execution'

export type {
  AdapterContext,
  AdapterResult,
  ICapabilityAdapter,
  AdapterFactory,
  AdapterRegistration,
  AdapterManifest,
  AdapterStartupDiagnostic,
} from './adapter'

export {
  type RuntimeFeatureFlags,
  DEFAULT_RUNTIME_FEATURE_FLAGS,
} from './flags'

export {
  type DependencyRelationType,
  type SubsystemDependency,
  type PermissionDependency,
  type CapabilityDependencyRequirement,
  CAPABILITY_DEPENDENCY_GRAPH,
} from './dependencies'

export type { RuntimeCorrelationChain } from './correlation'

export type {
  TimelineEventType,
  ExecutionTimelineEntry,
  ExecutionTimeline,
} from './timeline'

export type { ApprovalRequest, ApprovalResponse } from './approval'

export type { VerificationResult, VerificationLevel } from './verification'

export type { JournalEventType, JournalEntry } from './journal'

export type { ExecutionCheckpoint } from './checkpoint'

export type { ExecutionMetrics } from './metrics'

export type {
  SandboxOptions,
  SandboxLogEntry,
  SandboxExecutionResult,
} from './sandbox'

export type {
  NegotiationContext,
  NegotiationResult,
  ICapabilityNegotiator,
} from './negotiation'

export type {
  RegisteredAdapterInfo,
  ExecutionContextSnapshot,
} from './snapshot'

export type {
  TrackedResourceType,
  TrackedResource,
  IResourceManager,
} from './resource'

export type {
  SessionStatus,
  SessionScope,
  SessionLifecycle,
  IAdapterSession,
  SessionManagerOptions,
  ISessionManager,
} from './session'

export type {
  RetryPolicyConfig,
  ApprovalPolicyConfig,
  VerificationPolicyConfig,
  TimeoutPolicyConfig,
  AdapterPolicyConfig,
  ExecutionPolicy,
  IExecutionPolicyEngine,
} from './policy'

export type {
  SelectedAdapterRecord,
  ExecutionManifest,
} from './manifest'

