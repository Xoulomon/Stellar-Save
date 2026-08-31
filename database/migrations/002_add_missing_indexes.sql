-- Migration: 002_add_missing_indexes.sql
-- Issue #42 — database index review.
--
-- Adds indexes for query shapes that 001 left on a sequential scan. Every index
-- below is justified in database/INDEX_REVIEW.md with the query it serves and
-- the expected EXPLAIN ANALYZE plan change. Benchmark harness:
-- database/benchmarks/explain_analyze_indexes.sql
--
-- All statements are idempotent (IF NOT EXISTS) and additive — no existing
-- index or column is dropped or altered, so this migration is safe to re-run
-- and safe to roll back by dropping the four indexes.
--
-- Apply:  psql -U <user> -d <dbname> -f database/migrations/002_add_missing_indexes.sql

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- Index 3: Transaction-hash lookup (indexer idempotency)
-- The event indexer checks "have I already stored this tx?" on every polled
-- event before inserting. Without an index that is a full seq scan of `events`
-- per event. transaction_hash is high-cardinality; a plain btree is ideal.
-- Not UNIQUE: a single tx can emit multiple events.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_transaction_hash
    ON events (transaction_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index 4: Indexer cursor / reorg scan (resume from ledger)
-- On startup and after a reorg the indexer scans `events` by ledger_sequence
-- range ("everything at or after ledger N"). 001 has no ledger_sequence index.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_ledger_sequence
    ON events (ledger_sequence);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index 5: Per-group cycle payout lookup
-- Cycle-close / payout logic queries "all events for group G in cycle C".
-- idx_events_cycle_analytics (group_id, event_type, created_at) cannot serve
-- this because `cycle` is not a leading column and the predicate has no
-- event_type. Composite (group_id, cycle) is an index-only-friendly match.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_group_cycle
    ON events (group_id, cycle);

-- ─────────────────────────────────────────────────────────────────────────────
-- Index 6: Platform-wide activity feed (event_type, created_at)
-- The admin/analytics "recent activity across all groups" feed filters by
-- event_type and orders by created_at DESC with no group_id predicate, so
-- idx_events_cycle_analytics (leading column group_id) does not apply.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_type_created
    ON events (event_type, created_at DESC);

-- ─── Comments ────────────────────────────────────────────────────────────────
COMMENT ON INDEX idx_events_transaction_hash IS 'Indexer idempotency check (issue #42).';
COMMENT ON INDEX idx_events_ledger_sequence  IS 'Indexer resume-from-ledger / reorg scan (issue #42).';
COMMENT ON INDEX idx_events_group_cycle      IS 'Per-group cycle payout lookup (issue #42).';
COMMENT ON INDEX idx_events_type_created     IS 'Platform-wide activity feed, not group-scoped (issue #42).';

COMMIT;

-- Rollback:
--   DROP INDEX IF EXISTS idx_events_transaction_hash;
--   DROP INDEX IF EXISTS idx_events_ledger_sequence;
--   DROP INDEX IF EXISTS idx_events_group_cycle;
--   DROP INDEX IF EXISTS idx_events_type_created;
