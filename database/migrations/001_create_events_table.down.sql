-- Migration Rollback: 001_create_events_table.down.sql
-- Rolls back the events table and associated indexes created in 001_create_events_table.sql
--
-- WARNING: This will drop the events table and all data it contains.
-- Only run this if you intend to completely remove the events indexing system.
--
-- Rollback: psql -U <user> -d <dbname> -f database/migrations/001_create_events_table.down.sql

BEGIN;

-- Drop indexes first (foreign key dependencies)
DROP INDEX IF EXISTS idx_events_member_history;
DROP INDEX IF EXISTS idx_events_cycle_analytics;

-- Drop the main table
DROP TABLE IF EXISTS events;

COMMIT;
