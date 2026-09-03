import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

// ─────────────────────────────────────────────────────────────────────────────
// Schema Migrations version tracking
// ─────────────────────────────────────────────────────────────────────────────

export const schemaMigrations = sqliteTable('schema_migrations', {
  version: text('version').primaryKey(),
  appliedAt: integer('applied_at', { mode: 'number' }).notNull(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Providers
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Conversations
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Messages — future-proofed for Phase 3+ AI workflows
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Settings (singleton row)
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Application State (key-value store for misc persistent state)
// ─────────────────────────────────────────────────────────────────────────────

export const applicationState = sqliteTable('application_state', {
  key: text('key').primaryKey(),
  /** JSON-serialized value */
  value: text('value').notNull(),
  updatedAt: integer('updated_at', { mode: 'number' }).notNull(),
})

// ─────────────────────────────────────────────────────────────────────────────
// Type exports for use in repositories
// ─────────────────────────────────────────────────────────────────────────────

export type ConversationRow = typeof conversations.$inferSelect
export type NewConversationRow = typeof conversations.$inferInsert
export type MessageRow = typeof messages.$inferSelect
export type NewMessageRow = typeof messages.$inferInsert
export type SettingsRow = typeof settings.$inferSelect
export type ProviderRow = typeof providers.$inferSelect
export type NewProviderRow = typeof providers.$inferInsert
export type ApplicationStateRow = typeof applicationState.$inferSelect
