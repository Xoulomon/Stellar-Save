-- Migration Rollback: 002_add_missing_indexes.down.sql
-- Rolls back the indexes added in 002_add_missing_indexes.sql
--
-- This rollback is safe and non-destructive — it only removes indexes,
-- not data. The events table and its original indexes from 001 remain intact.
--
-- Rollback: psql -U <user> -d <dbname> -f database/migrations/002_add_missing_indexes.down.sql

BEGIN;

-- Drop indexes added in migration 002
DROP INDEX IF EXISTS idx_events_transaction_hash;
DROP INDEX IF EXISTS idx_events_ledger_sequence;
DROP INDEX IF EXISTS idx_events_group_cycle;
DROP INDEX IF EXISTS idx_events_type_created;

COMMIT;
