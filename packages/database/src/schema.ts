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

// Messages — future-proofed for Phase 3+ AI workflows

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
   * Nullable in Phase 1, populated in Phase 2.
   */
  attachments: text('attachments'),
  /**
   * JSON: ToolCall[] — tool calls requested by the model.
   * Nullable in Phase 1, populated in Phase 3.
   */
  toolCalls: text('tool_calls'),
  /**
   * JSON: ToolResult[] — results from tool execution.
   * Nullable in Phase 1, populated in Phase 3.
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

// Phase 2: Planner Tables

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
