-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 0003: Execution Schema
-- Created: 2026-09-08
-- Adds execution and capability tables.
-- ─────────────────────────────────────────────────────────────────────────────

-- Execution Runs — orchestrates execution instances
CREATE TABLE IF NOT EXISTS execution_runs (
  id               TEXT PRIMARY KEY,
  plan_id          TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  blueprint_hash   TEXT NOT NULL,
  trace_id         TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'created'
    CHECK(status IN ('created','running','paused','waiting_approval','recovering','completed','failed','cancelled')),
  started_at       INTEGER NOT NULL,
  completed_at     INTEGER,
  error_code       TEXT,
  tasks_total      INTEGER NOT NULL DEFAULT 0,
  tasks_completed  INTEGER NOT NULL DEFAULT 0,
  tasks_failed     INTEGER NOT NULL DEFAULT 0,
  tasks_skipped    INTEGER NOT NULL DEFAULT 0,
  context_snapshot TEXT,  -- JSON: ExecutionContextSnapshot
  metadata         TEXT   -- JSON: Record<string, unknown>
);

CREATE INDEX IF NOT EXISTS idx_execution_runs_plan_id ON execution_runs(plan_id);
CREATE INDEX IF NOT EXISTS idx_execution_runs_trace_id ON execution_runs(trace_id);
CREATE INDEX IF NOT EXISTS idx_execution_runs_status ON execution_runs(status);
CREATE INDEX IF NOT EXISTS idx_execution_runs_started_at ON execution_runs(started_at DESC);

-- Execution Task Records — individual task execution results
CREATE TABLE IF NOT EXISTS execution_task_records (
  id                  TEXT PRIMARY KEY,
  run_id              TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  task_id             TEXT NOT NULL,
  task_title          TEXT NOT NULL,
  capability          TEXT NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  attempt_count       INTEGER NOT NULL DEFAULT 0,
  adapter_name        TEXT,
  adapter_result      TEXT,  -- JSON: AdapterResult
  verification_result TEXT,  -- JSON: VerificationResult
  failure_category    TEXT,
  started_at          INTEGER,
  completed_at        INTEGER,
  error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_execution_task_records_run_id ON execution_task_records(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_task_records_task_id ON execution_task_records(task_id);

-- Execution Journal — append-only audit trail
CREATE TABLE IF NOT EXISTS execution_journal (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  trace_id       TEXT NOT NULL,
  task_id        TEXT,
  event_type     TEXT NOT NULL,
  adapter_name   TEXT,
  state_from     TEXT,
  state_to       TEXT,
  attempt_number INTEGER,
  payload        TEXT NOT NULL DEFAULT '{}',  -- JSON: Record<string, unknown>
  timestamp      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_journal_run_id ON execution_journal(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_journal_trace_id ON execution_journal(trace_id);
CREATE INDEX IF NOT EXISTS idx_execution_journal_timestamp ON execution_journal(timestamp DESC);

-- Execution Checkpoints — deterministic recovery state
CREATE TABLE IF NOT EXISTS execution_checkpoints (
  id                       TEXT PRIMARY KEY,
  run_id                   TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  created_at               INTEGER NOT NULL,
  execution_status         TEXT NOT NULL,
  completed_task_ids       TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  pending_task_ids         TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  failed_task_ids          TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  skipped_task_ids         TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  retry_counters           TEXT NOT NULL DEFAULT '{}',  -- JSON: Record<string, number>
  pending_approval_task_id TEXT,
  metadata                 TEXT NOT NULL DEFAULT '{}'   -- JSON: Record<string, unknown>
);

CREATE INDEX IF NOT EXISTS idx_execution_checkpoints_run_id ON execution_checkpoints(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_checkpoints_created_at ON execution_checkpoints(created_at DESC);

-- Approval Requests — human-in-the-loop gates
CREATE TABLE IF NOT EXISTS approval_requests (
  id              TEXT PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  task_id         TEXT NOT NULL,
  task_title      TEXT NOT NULL,
  capability      TEXT NOT NULL,
  approval_reason TEXT NOT NULL,
  policy          TEXT NOT NULL CHECK(policy IN ('automatic','optional','mandatory','forbidden')),
  requested_at    INTEGER NOT NULL,
  expires_at      INTEGER,
  responded_at    INTEGER,
  approved        INTEGER,  -- boolean: 0 or 1
  comment         TEXT
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_run_id ON approval_requests(run_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_task_id ON approval_requests(task_id);

-- Verification Results — post-task validation proof
CREATE TABLE IF NOT EXISTS verification_results (
  id                 TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  task_id            TEXT NOT NULL,
  passed             INTEGER NOT NULL DEFAULT 0,
  checked_conditions TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  failed_conditions  TEXT NOT NULL DEFAULT '[]',  -- JSON: string[]
  strategy           TEXT NOT NULL DEFAULT 'state_check',
  notes              TEXT,
  duration_ms        INTEGER NOT NULL DEFAULT 0,
  created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_results_run_id ON verification_results(run_id);
CREATE INDEX IF NOT EXISTS idx_verification_results_task_id ON verification_results(task_id);

-- Execution Reports — comprehensive run outcome
CREATE TABLE IF NOT EXISTS execution_reports (
  id                 TEXT PRIMARY KEY,
  run_id             TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  trace_id           TEXT NOT NULL,
  summary            TEXT NOT NULL,
  task_summaries     TEXT NOT NULL DEFAULT '[]',    -- JSON: TaskSummary[]
  failure_categories TEXT NOT NULL DEFAULT '[]',    -- JSON: FailureCategory[]
  metrics            TEXT NOT NULL DEFAULT '{}',    -- JSON: ExecutionMetrics
  blueprint_hash     TEXT,
  execution_hash     TEXT,
  planner_version    TEXT,
  execution_version  TEXT,
  adapter_versions   TEXT,  -- JSON: Record<string, string>
  context_snapshot   TEXT,  -- JSON: ExecutionContextSnapshot
  created_at         INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_reports_run_id ON execution_reports(run_id);
CREATE INDEX IF NOT EXISTS idx_execution_reports_trace_id ON execution_reports(trace_id);

-- Execution Manifests — tamper-evident artifact
CREATE TABLE IF NOT EXISTS execution_manifests (
  id            TEXT PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES execution_runs(id) ON DELETE CASCADE,
  manifest_hash TEXT NOT NULL,
  manifest      TEXT NOT NULL,  -- JSON: ExecutionManifest
  created_at    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_execution_manifests_run_id ON execution_manifests(run_id);

-- Record this migration
INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES ('0003', unixepoch() * 1000);
