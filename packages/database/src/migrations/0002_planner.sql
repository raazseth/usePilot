-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0002: Planner Schema
-- Created: 2026-09-04
-- Adds all Phase 2 planning tables.
-- Phase 1 tables are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

-- Goals — the structured objective extracted from raw user input
CREATE TABLE IF NOT EXISTS goals (
  id                 TEXT PRIMARY KEY,
  conversation_id    TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  raw_text           TEXT NOT NULL,
  normalized_text    TEXT NOT NULL,
  primary_objective  TEXT NOT NULL,
  constraints        TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  required_resources TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  expected_outcome   TEXT NOT NULL,
  context            TEXT,
  confidence         REAL NOT NULL DEFAULT 0,
  status             TEXT NOT NULL DEFAULT 'pending'
    CHECK(status IN ('pending', 'extracting', 'validated', 'failed')),
  created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_goals_conversation_id ON goals(conversation_id);
CREATE INDEX IF NOT EXISTS idx_goals_created_at ON goals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_goals_status ON goals(status);

-- Planner Runs — every planning attempt, including failures
CREATE TABLE IF NOT EXISTS planner_runs (
  id              TEXT PRIMARY KEY,
  goal_id         TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  conversation_id TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  status          TEXT NOT NULL DEFAULT 'started'
    CHECK(status IN ('started', 'succeeded', 'failed', 'cancelled')),
  stage_reached   TEXT NOT NULL DEFAULT 'classifying',
  started_at      INTEGER NOT NULL,
  completed_at    INTEGER,
  error_code      TEXT,
  retries         INTEGER NOT NULL DEFAULT 0,
  token_count     INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_planner_runs_goal_id ON planner_runs(goal_id);
CREATE INDEX IF NOT EXISTS idx_planner_runs_status ON planner_runs(status);
CREATE INDEX IF NOT EXISTS idx_planner_runs_started_at ON planner_runs(started_at DESC);

-- Plans — the final ExecutionBlueprint
CREATE TABLE IF NOT EXISTS plans (
  id                    TEXT PRIMARY KEY,
  run_id                TEXT NOT NULL REFERENCES planner_runs(id) ON DELETE CASCADE,
  goal_id               TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  conversation_id       TEXT REFERENCES conversations(id) ON DELETE SET NULL,
  version               INTEGER NOT NULL DEFAULT 1,
  hash                  TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'ready'
    CHECK(status IN ('pending','generating','validating','optimizing','ready','invalid','executing','completed','failed')),
  execution_blueprint   TEXT NOT NULL,  -- JSON: ExecutionBlueprint
  validation_result     TEXT,           -- JSON: ValidationResult
  planning_duration_ms  INTEGER,
  created_at            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plans_goal_id ON plans(goal_id);
CREATE INDEX IF NOT EXISTS idx_plans_conversation_id ON plans(conversation_id);
CREATE INDEX IF NOT EXISTS idx_plans_hash ON plans(hash);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans(status);
CREATE INDEX IF NOT EXISTS idx_plans_created_at ON plans(created_at DESC);

-- Tasks — denormalized for querying without deserializing the full blueprint
CREATE TABLE IF NOT EXISTS plan_tasks (
  id                   TEXT PRIMARY KEY,
  plan_id              TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  external_id          TEXT NOT NULL,  -- Task.id from the blueprint
  title                TEXT NOT NULL,
  description          TEXT,
  category             TEXT,
  required_tool        TEXT,
  preconditions        TEXT DEFAULT '[]',   -- JSON: string[]
  postconditions       TEXT DEFAULT '[]',   -- JSON: string[]
  success_conditions   TEXT DEFAULT '[]',   -- JSON: string[]
  failure_conditions   TEXT DEFAULT '[]',   -- JSON: string[]
  approval_policy      TEXT NOT NULL DEFAULT 'automatic'
    CHECK(approval_policy IN ('automatic','optional','mandatory','forbidden')),
  approval_reason      TEXT,
  complexity           TEXT,
  status               TEXT NOT NULL DEFAULT 'pending',
  created_at           INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_tasks_plan_id ON plan_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_tasks_approval_policy ON plan_tasks(approval_policy);

-- Task dependencies — explicit DAG edges
CREATE TABLE IF NOT EXISTS task_deps (
  id                TEXT PRIMARY KEY,
  plan_id           TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  task_id           TEXT NOT NULL,       -- external_id of the dependent task
  depends_on_task_id TEXT NOT NULL,      -- external_id of the prerequisite task
  edge_type         TEXT NOT NULL DEFAULT 'depends_on'
    CHECK(edge_type IN ('depends_on','triggers','blocks')),
  edge_metadata     TEXT                 -- JSON: optional metadata
);

CREATE INDEX IF NOT EXISTS idx_task_deps_plan_id ON task_deps(plan_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_task_id ON task_deps(task_id);

-- Plan validation results — stored separately for querying
CREATE TABLE IF NOT EXISTS plan_validations (
  id              TEXT PRIMARY KEY,
  plan_id         TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  schema_valid    INTEGER NOT NULL DEFAULT 0,
  semantic_valid  INTEGER NOT NULL DEFAULT 0,
  execution_valid INTEGER NOT NULL DEFAULT 0,
  errors          TEXT DEFAULT '[]',      -- JSON: ValidationIssue[]
  warnings        TEXT DEFAULT '[]',      -- JSON: ValidationIssue[]
  suggestions     TEXT DEFAULT '[]',      -- JSON: ValidationIssue[]
  validated_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_validations_plan_id ON plan_validations(plan_id);

-- Plan version history — stores previous blueprint versions
CREATE TABLE IF NOT EXISTS plan_versions (
  id                  TEXT PRIMARY KEY,
  plan_id             TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  version             INTEGER NOT NULL,
  hash                TEXT NOT NULL,
  execution_blueprint TEXT NOT NULL,  -- JSON: ExecutionBlueprint
  created_at          INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan_id ON plan_versions(plan_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_versions_unique ON plan_versions(plan_id, version);

-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('0002', unixepoch() * 1000);
