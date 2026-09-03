-- ─────────────────────────────────────────────────────────────────────────────
-- Rollback Migration 0001: Drop all tables
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS application_state;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS providers;
DROP TABLE IF EXISTS schema_migrations;
