-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback Migration 0003: Drop all execution tables
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS execution_manifests;
DROP TABLE IF EXISTS execution_reports;
DROP TABLE IF EXISTS verification_results;
DROP TABLE IF EXISTS approval_requests;
DROP TABLE IF EXISTS execution_checkpoints;
DROP TABLE IF EXISTS execution_journal;
DROP TABLE IF EXISTS execution_task_records;
DROP TABLE IF EXISTS execution_runs;

DELETE FROM schema_migrations WHERE version = '0003';
