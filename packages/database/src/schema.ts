import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// Schema Migrations version tracking

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: text('version').primaryKey(),
  appliedAt: integer('applied_at', { mode: 'number' }).notNull(),
})

// Providers

export const providers = sqliteTable('providers', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: ['ollama', 'lmstudio', 'openai-compatible'] }).notNull(),
  baseUrl: text('base_url').notNull(),
  isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

// Conversations

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  /** Provider active at last message time */
  providerId: text('provider_id').references(() => providers.id, { onDelete: 'set null' }),
  /** Model active at last message time */
  model: text('model'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
  /** Soft delete — null means active */
  deletedAt: integer('deleted_at', { mode: 'number' }),
})

// Messages

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system', 'tool'] }).notNull(),
  /** Text content — nullable for tool result messages */
  content: text('content'),
  /**
   * JSON: MessageMetadata — model, finishReason, usage, latency, etc.
   * Nullable until populated post-generation.
   */
  metadata: text('metadata'),
  /**
   * JSON: MessageAttachment[] — file/image attachments.
   */
  attachments: text('attachments'),
  /**
   * JSON: ToolCall[] — tool calls requested by the model.
   */
  toolCalls: text('tool_calls'),
  /**
   * JSON: ToolResult[] — results from tool execution.
   */
  toolResults: text('tool_results'),
  /** Message lifecycle status */
  status: text('status', {
    enum: ['pending', 'streaming', 'complete', 'error', 'cancelled'],
  })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  /** Soft delete */
  deletedAt: integer('deleted_at', { mode: 'number' }),
})

// Settings (singleton row)

export const settings = sqliteTable('settings', {
  /** Always 'default' — singleton row pattern */
  id: text('id').primaryKey().default('default'),
  theme: text('theme', { enum: ['dark', 'light', 'system'] }).notNull().default('dark'),
  activeProviderId: text('active_provider_id').references(() => providers.id, {
    onDelete: 'set null',
  }),
  /** Denormalized for quick access — keep in sync with activeProviderId */
  activeProviderType: text('active_provider_type', {
    enum: ['ollama', 'lmstudio', 'openai-compatible'],
  }),
  defaultModel: text('default_model'),
  streamingEnabled: integer('streaming_enabled', { mode: 'boolean' }).notNull().default(true),
  temperature: text('temperature').notNull().default('0.7'),
  maxTokens: integer('max_tokens'),
  storagePath: text('storage_path'),
  /** JSON: FeatureFlags — merged with defaults at runtime */
  featureFlags: text('feature_flags').notNull().default('{}'),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

// Application State (key-value store for misc persistent state)

export const applicationState = sqliteTable('application_state', {
  key: text('key').primaryKey(),
  /** JSON-serialized value */
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

// Type exports for use in repositories

export type ConversationRow = typeof conversations.$inferSelect
export type NewConversationRow = typeof conversations.$inferInsert
export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert
export type SettingsRow = typeof settings.$inferSelect
export type ProviderRow = typeof providers.$inferSelect
export type NewProviderRow = typeof providers.$inferInsert
export type ApplicationStateRow = typeof applicationState.$inferSelect

// Planner Tables

export const goals = sqliteTable('goals', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  rawText: text('raw_text').notNull(),
  normalizedText: text('normalized_text').notNull(),
  primaryObjective: text('primary_objective').notNull(),
  /** JSON: string[] */
  constraints: text('constraints').notNull().default('[]'),
  /** JSON: string[] */
  requiredResources: text('required_resources').notNull().default('[]'),
  expectedOutcome: text('expected_outcome').notNull(),
  context: text('context'),
  confidence: integer('confidence', { mode: 'number' }).notNull().default(0),
  status: text('status', { enum: ['pending', 'extracting', 'validated', 'failed'] })
    .notNull()
    .default('pending'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export const plannerRuns = sqliteTable('planner_runs', {
  id: text('id').primaryKey(),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  status: text('status', { enum: ['started', 'succeeded', 'failed', 'cancelled'] })
    .notNull()
    .default('started'),
  stageReached: text('stage_reached').notNull().default('classifying'),
  startedAt: integer('started_at', { mode: 'number' }).notNull(),
  completedAt: integer('completed_at', { mode: 'number' }),
  errorCode: text('error_code'),
  retries: integer('retries', { mode: 'number' }).notNull().default(0),
  tokenCount: integer('token_count', { mode: 'number' }).notNull().default(0),
})

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => plannerRuns.id, { onDelete: 'cascade' }),
  goalId: text('goal_id')
    .notNull()
    .references(() => goals.id, { onDelete: 'cascade' }),
  conversationId: text('conversation_id').references(() => conversations.id, { onDelete: 'set null' }),
  version: integer('version', { mode: 'number' }).notNull().default(1),
  hash: text('hash').notNull(),
  status: text('status', {
    enum: ['pending', 'generating', 'validating', 'optimizing', 'needs_info', 'ready', 'invalid', 'executing', 'completed', 'failed'],
  })
    .notNull()
    .default('ready'),
  /** JSON: ExecutionBlueprint */
  executionBlueprint: text('execution_blueprint').notNull(),
  /** JSON: ValidationResult */
  validationResult: text('validation_result'),
  planningDurationMs: integer('planning_duration_ms', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export const planTasks = sqliteTable('plan_tasks', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category'),
  requiredTool: text('required_tool'),
  preconditions: text('preconditions').notNull().default('[]'),
  postconditions: text('postconditions').notNull().default('[]'),
  successConditions: text('success_conditions').notNull().default('[]'),
  failureConditions: text('failure_conditions').notNull().default('[]'),
  approvalPolicy: text('approval_policy', {
    enum: ['automatic', 'optional', 'mandatory', 'forbidden'],
  })
    .notNull()
    .default('automatic'),
  approvalReason: text('approval_reason'),
  complexity: text('complexity'),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export const taskDeps = sqliteTable('task_deps', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  dependsOnTaskId: text('depends_on_task_id').notNull(),
  edgeType: text('edge_type', { enum: ['depends_on', 'triggers', 'blocks'] })
    .notNull()
    .default('depends_on'),
  edgeMetadata: text('edge_metadata'),
})

export const planValidations = sqliteTable('plan_validations', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  schemaValid: integer('schema_valid', { mode: 'boolean' }).notNull().default(false),
  semanticValid: integer('semantic_valid', { mode: 'boolean' }).notNull().default(false),
  executionValid: integer('execution_valid', { mode: 'boolean' }).notNull().default(false),
  errors: text('errors').notNull().default('[]'),
  warnings: text('warnings').notNull().default('[]'),
  suggestions: text('suggestions').notNull().default('[]'),
  validatedAt: integer('validated_at', { mode: 'number' }).notNull(),
})

export const planVersions = sqliteTable('plan_versions', {
  id: text('id').primaryKey(),
  planId: text('plan_id')
    .notNull()
    .references(() => plans.id, { onDelete: 'cascade' }),
  version: integer('version', { mode: 'number' }).notNull(),
  hash: text('hash').notNull(),
  executionBlueprint: text('execution_blueprint').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

// Planner Type Exports

export type GoalRow = typeof goals.$inferSelect
export type NewGoalRow = typeof goals.$inferInsert
export type PlannerRunRow = typeof plannerRuns.$inferSelect
export type NewPlannerRunRow = typeof plannerRuns.$inferInsert
export type PlanRow = typeof plans.$inferSelect
export type NewPlanRow = typeof plans.$inferInsert
export type PlanTaskRow = typeof planTasks.$inferSelect
export type PlanValidationRow = typeof planValidations.$inferSelect

// Execution Tables

export const executionRuns = sqliteTable('execution_runs', {
  id: text('id').primaryKey(),
  planId: text('plan_id').notNull().references(() => plans.id, { onDelete: 'cascade' }),
  blueprintHash: text('blueprint_hash').notNull(),
  traceId: text('trace_id').notNull(),
  status: text('status', {
    enum: ['created', 'running', 'paused', 'waiting_approval', 'recovering', 'completed', 'failed', 'cancelled'],
  }).notNull().default('created'),
  startedAt: integer('started_at', { mode: 'number' }).notNull(),
  completedAt: integer('completed_at', { mode: 'number' }),
  errorCode: text('error_code'),
  tasksTotal: integer('tasks_total', { mode: 'number' }).notNull().default(0),
  tasksCompleted: integer('tasks_completed', { mode: 'number' }).notNull().default(0),
  tasksFailed: integer('tasks_failed', { mode: 'number' }).notNull().default(0),
  tasksSkipped: integer('tasks_skipped', { mode: 'number' }).notNull().default(0),
  /** JSON: ExecutionContextSnapshot */
  contextSnapshot: text('context_snapshot'),
  /** JSON: Record<string, unknown> */
  metadata: text('metadata'),
})

export const executionTaskRecords = sqliteTable('execution_task_records', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  taskTitle: text('task_title').notNull(),
  capability: text('capability').notNull(),
  status: text('status').notNull().default('pending'),
  attemptCount: integer('attempt_count', { mode: 'number' }).notNull().default(0),
  adapterName: text('adapter_name'),
  /** JSON: AdapterResult */
  adapterResult: text('adapter_result'),
  /** JSON: VerificationResult */
  verificationResult: text('verification_result'),
  failureCategory: text('failure_category'),
  startedAt: integer('started_at', { mode: 'number' }),
  completedAt: integer('completed_at', { mode: 'number' }),
  errorMessage: text('error_message'),
})

export const executionJournal = sqliteTable('execution_journal', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  traceId: text('trace_id').notNull(),
  taskId: text('task_id'),
  eventType: text('event_type').notNull(),
  adapterName: text('adapter_name'),
  stateFrom: text('state_from'),
  stateTo: text('state_to'),
  attemptNumber: integer('attempt_number', { mode: 'number' }),
  /** JSON: Record<string, unknown> */
  payload: text('payload').notNull().default('{}'),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
})

export const executionCheckpoints = sqliteTable('execution_checkpoints', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  executionStatus: text('execution_status').notNull(),
  /** JSON: string[] */
  completedTaskIds: text('completed_task_ids').notNull().default('[]'),
  /** JSON: string[] */
  pendingTaskIds: text('pending_task_ids').notNull().default('[]'),
  /** JSON: string[] */
  failedTaskIds: text('failed_task_ids').notNull().default('[]'),
  /** JSON: string[] */
  skippedTaskIds: text('skipped_task_ids').notNull().default('[]'),
  /** JSON: Record<string, number> */
  retryCounters: text('retry_counters').notNull().default('{}'),
  pendingApprovalTaskId: text('pending_approval_task_id'),
  /** JSON: Record<string, unknown> */
  metadata: text('metadata').notNull().default('{}'),
})

export const approvalRequests = sqliteTable('approval_requests', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  taskTitle: text('task_title').notNull(),
  capability: text('capability').notNull(),
  approvalReason: text('approval_reason').notNull(),
  policy: text('policy', { enum: ['automatic', 'optional', 'mandatory', 'forbidden'] }).notNull(),
  requestedAt: integer('requested_at', { mode: 'number' }).notNull(),
  expiresAt: integer('expires_at', { mode: 'number' }),
  respondedAt: integer('responded_at', { mode: 'number' }),
  approved: integer('approved', { mode: 'boolean' }),
  comment: text('comment'),
})

export const verificationResults = sqliteTable('verification_results', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  taskId: text('task_id').notNull(),
  passed: integer('passed', { mode: 'boolean' }).notNull().default(false),
  /** JSON: string[] */
  checkedConditions: text('checked_conditions').notNull().default('[]'),
  /** JSON: string[] */
  failedConditions: text('failed_conditions').notNull().default('[]'),
  strategy: text('strategy').notNull().default('state_check'),
  notes: text('notes'),
  durationMs: integer('duration_ms', { mode: 'number' }).notNull().default(0),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export const executionReports = sqliteTable('execution_reports', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  traceId: text('trace_id').notNull(),
  summary: text('summary').notNull(),
  /** JSON: TaskSummary[] */
  taskSummaries: text('task_summaries').notNull().default('[]'),
  /** JSON: FailureCategory[] */
  failureCategories: text('failure_categories').notNull().default('[]'),
  /** JSON: ExecutionMetrics */
  metrics: text('metrics').notNull().default('{}'),
  blueprintHash: text('blueprint_hash'),
  executionHash: text('execution_hash'),
  plannerVersion: text('planner_version'),
  executionVersion: text('execution_version'),
  /** JSON: Record<string, string> */
  adapterVersions: text('adapter_versions'),
  /** JSON: ExecutionContextSnapshot */
  contextSnapshot: text('context_snapshot'),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export const executionManifests = sqliteTable('execution_manifests', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => executionRuns.id, { onDelete: 'cascade' }),
  manifestHash: text('manifest_hash').notNull(),
  /** JSON: ExecutionManifest */
  manifest: text('manifest').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

// Execution Type Exports

export type ExecutionRunRow = typeof executionRuns.$inferSelect
export type NewExecutionRunRow = typeof executionRuns.$inferInsert
export type ExecutionTaskRecordRow = typeof executionTaskRecords.$inferSelect
export type NewExecutionTaskRecordRow = typeof executionTaskRecords.$inferInsert
export type ExecutionJournalRow = typeof executionJournal.$inferSelect
export type NewExecutionJournalRow = typeof executionJournal.$inferInsert
export type ExecutionCheckpointRow = typeof executionCheckpoints.$inferSelect
export type NewExecutionCheckpointRow = typeof executionCheckpoints.$inferInsert
export type ApprovalRequestRow = typeof approvalRequests.$inferSelect
export type NewApprovalRequestRow = typeof approvalRequests.$inferInsert
export type VerificationResultRow = typeof verificationResults.$inferSelect
export type ExecutionReportRow = typeof executionReports.$inferSelect
export type ExecutionManifestRow = typeof executionManifests.$inferSelect
export type NewExecutionManifestRow = typeof executionManifests.$inferInsert

// Intelligence & Runtime Context Tables

export const runtimeContext = sqliteTable('runtime_context', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  version: integer('version').notNull(),
  /** JSON: RuntimeContextState */
  statePayload: text('state_payload').notNull(),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

export const observations = sqliteTable('observations', {
  id: text('id').primaryKey(),
  correlationId: text('correlation_id'),
  type: text('type').notNull(),
  source: text('source').notNull(),
  confidence: integer('confidence', { mode: 'number' }).notNull(), // Scaled integer (e.g. 0-100 or float)
  /** JSON: Observation Payload */
  payload: text('payload').notNull(),
  /** JSON: ContextProvenance */
  provenance: text('provenance').notNull(),
  /** JSON: Record<string, unknown> */
  metadata: text('metadata'),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
})

export const knowledgeStore = sqliteTable('knowledge_store', {
  id: text('id').primaryKey(),
  compoundKey: text('compound_key').notNull().unique(),
  key: text('key').notNull(),
  category: text('category').notNull(),
  policy: text('policy').notNull(),
  /** JSON: Data payload */
  data: text('data').notNull(),
  /** JSON: ContextProvenance */
  provenance: text('provenance').notNull(),
  version: integer('version').notNull(),
  expiresAt: integer('expires_at', { mode: 'number' }),
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

export const browserGraph = sqliteTable('browser_graph', {
  domain: text('domain').primaryKey(),
  rootUrl: text('root_url').notNull(),
  /** JSON: Record<string, BrowserPageNode> */
  nodesJson: text('nodes_json').notNull(),
  authenticated: integer('authenticated', { mode: 'boolean' }).notNull().default(false),
  discoveredAt: integer('discovered_at', { mode: 'number' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

export const runtimeIndex = sqliteTable('runtime_index', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  /** JSON: string[] */
  tags: text('tags').notNull(),
  /** JSON: ContextProvenance */
  provenance: text('provenance').notNull(),
  /** JSON: number[] optional embedding vector */
  vectorJson: text('vector_json'),
  indexedAt: integer('indexed_at', { mode: 'number' }).notNull(),
})

export const executionMemory = sqliteTable('execution_memory', {
  id: text('id').primaryKey(),
  executionId: text('execution_id').notNull(),
  blueprintId: text('blueprint_id').notNull(),
  intent: text('intent').notNull(),
  /** JSON: string[] */
  capabilitySequence: text('capability_sequence').notNull(),
  /** JSON: string[] */
  domainTargets: text('domain_targets').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  failureReason: text('failure_reason'),
  durationMs: integer('duration_ms', { mode: 'number' }).notNull(),
  approvalCount: integer('approval_count', { mode: 'number' }).notNull(),
  verificationPassed: integer('verification_passed', { mode: 'boolean' }).notNull(),
  healingEventCount: integer('healing_event_count', { mode: 'number' }).notNull(),
  artifactsProducedCount: integer('artifacts_produced_count', { mode: 'number' }).notNull(),
  /** JSON: ContextProvenance */
  provenance: text('provenance').notNull(),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
  /** JSON: string[] */
  tags: text('tags').notNull(),
})

export const contextSnapshots = sqliteTable('context_snapshots', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  /** JSON: RuntimeContextState */
  statePayload: text('state_payload').notNull(),
  timestamp: integer('timestamp', { mode: 'number' }).notNull(),
})

export const replaySessions = sqliteTable('replay_sessions', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull(),
  totalSteps: integer('total_steps', { mode: 'number' }).notNull(),
  currentStep: integer('current_step', { mode: 'number' }).notNull(),
  status: text('status').notNull(), // 'active' | 'completed'
  createdAt: integer('created_at', { mode: 'number' }).notNull(),
})

export type RuntimeContextRow = typeof runtimeContext.$inferSelect
export type NewRuntimeContextRow = typeof runtimeContext.$inferInsert
export type ObservationRow = typeof observations.$inferSelect
export type NewObservationRow = typeof observations.$inferInsert
export type KnowledgeStoreRow = typeof knowledgeStore.$inferSelect
export type NewKnowledgeStoreRow = typeof knowledgeStore.$inferInsert
export type BrowserGraphRow = typeof browserGraph.$inferSelect
export type NewBrowserGraphRow = typeof browserGraph.$inferInsert
export type RuntimeIndexRow = typeof runtimeIndex.$inferSelect
export type NewRuntimeIndexRow = typeof runtimeIndex.$inferInsert
export type ExecutionMemoryRow = typeof executionMemory.$inferSelect
export type NewExecutionMemoryRow = typeof executionMemory.$inferInsert
export type ContextSnapshotRow = typeof contextSnapshots.$inferSelect
export type NewContextSnapshotRow = typeof contextSnapshots.$inferInsert
export type ReplaySessionRow = typeof replaySessions.$inferSelect
export type NewReplaySessionRow = typeof replaySessions.$inferInsert

