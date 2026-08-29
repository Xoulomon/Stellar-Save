-- =============================================================================
-- Migration Template
-- File Naming Pattern: database/migrations/NNN_short_description.sql
-- =============================================================================
-- Description: Short summary of schema modifications
-- Ticket / Issue: #<ISSUE_NUMBER>
-- Author: <AUTHOR_NAME>
-- Date: YYYY-MM-DD
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- UP MIGRATION
-- -----------------------------------------------------------------------------

-- Example CREATE TABLE or ALTER TABLE statements:
-- CREATE TABLE IF NOT EXISTS example_entity (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(255) NOT NULL,
--     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- Example CREATE INDEX CONCURRENTLY (Note: outside transaction if PostgreSQL):
-- CREATE INDEX IF NOT EXISTS idx_example_entity_created_at ON example_entity(created_at);

-- -----------------------------------------------------------------------------
-- DOWN MIGRATION (Rollback execution template)
-- -----------------------------------------------------------------------------

-- Example DROP statements:
-- DROP INDEX IF EXISTS idx_example_entity_created_at;
-- DROP TABLE IF EXISTS example_entity;

COMMIT;
