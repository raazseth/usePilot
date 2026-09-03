-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0001: Initial Schema
-- Created: 2026-09-03
-- ─────────────────────────────────────────────────────────────────────────────

-- Migration version tracking
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);

-- Providers
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('ollama', 'lmstudio', 'openai-compatible')),
  base_url TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);
CREATE INDEX IF NOT EXISTS idx_providers_is_default ON providers(is_default);

-- Conversations
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  model TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at ON conversations(deleted_at);

-- Messages (future-proofed)
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
  content TEXT,
  metadata TEXT,           -- JSON: MessageMetadata
  attachments TEXT,        -- JSON: MessageAttachment[]  (Phase 2)
  tool_calls TEXT,         -- JSON: ToolCall[]           (Phase 3)
  tool_results TEXT,       -- JSON: ToolResult[]         (Phase 3)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'streaming', 'complete', 'error', 'cancelled')),
  created_at INTEGER NOT NULL,
  deleted_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
CREATE INDEX IF NOT EXISTS idx_messages_deleted_at ON messages(deleted_at);

-- Settings (singleton)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  theme TEXT NOT NULL DEFAULT 'dark' CHECK(theme IN ('dark', 'light', 'system')),
  active_provider_id TEXT REFERENCES providers(id) ON DELETE SET NULL,
  active_provider_type TEXT CHECK(active_provider_type IN ('ollama', 'lmstudio', 'openai-compatible')),
  default_model TEXT,
  streaming_enabled INTEGER NOT NULL DEFAULT 1,
  temperature TEXT NOT NULL DEFAULT '0.7',
  max_tokens INTEGER,
  storage_path TEXT,
  feature_flags TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

-- Application state (key-value)
CREATE TABLE IF NOT EXISTS application_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('0001', unixepoch() * 1000);
