-- =============================================================================
-- Migration Template
-- File Naming Pattern: database/migrations/NNN_short_description.sql
-- =============================================================================
-- Description: Short summary of schema modifications
-- Issue: #<ISSUE_NUMBER>
-- Author: <AUTHOR_NAME>
-- Date: YYYY-MM-DD
-- Dependencies: List any migrations that must be applied first
-- =============================================================================
--
-- Apply:  psql -U <user> -d <dbname> -f database/migrations/NNN_short_description.sql
--
-- IMPORTANT: Every migration MUST have a corresponding .down.sql rollback file!
--            See database/MIGRATION_CONVENTIONS.md for details.
-- =============================================================================

BEGIN;

-- ─── UP MIGRATION ─────────────────────────────────────────────────────────────
-- All DDL statements to apply the migration
-- Use IF NOT EXISTS / IF EXISTS for idempotency

-- Example CREATE TABLE:
-- CREATE TABLE IF NOT EXISTS example_entity (
--     id BIGSERIAL PRIMARY KEY,
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Example CREATE INDEX:
-- CREATE INDEX IF NOT EXISTS idx_example_entity_created_at 
--     ON example_entity (created_at DESC);

-- ─── COMMENTS ──────────────────────────────────────────────────────────────────
-- Document the purpose of tables and indexes

-- COMMENT ON TABLE example_entity IS 'Description of table purpose';
-- COMMENT ON INDEX idx_example_entity_created_at IS 'Description of index purpose';

COMMIT;

-- ─── DOWN MIGRATION (Rollback) ────────────────────────────────────────────────
-- Create a separate file: NNN_short_description.down.sql
--
-- Template for down migration:
--
-- -- Migration Rollback: NNN_short_description.down.sql
-- -- Rolls back changes made in NNN_short_description.sql
-- --
-- -- WARNING: [Describe any data loss or impacts]
-- --
-- -- Rollback: psql -U <user> -d <dbname> -f database/migrations/NNN_short_description.down.sql
--
-- BEGIN;
--
-- -- Drop objects in reverse order of creation
-- DROP INDEX IF EXISTS idx_example_entity_created_at;
-- DROP TABLE IF EXISTS example_entity;
--
-- COMMIT;
--
-- For more details, see database/MIGRATION_CONVENTIONS.md
