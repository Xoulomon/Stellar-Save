-- explain_analyze_indexes.sql
-- Measures query execution time before and after adding the analytics indexes.
--
-- Usage:
--   1. Run the BEFORE blocks BEFORE applying the migration (drop indexes if needed).
--   2. Apply 001_create_events_table.sql
--   3. Run the AFTER blocks and compare Planning/Execution times.
--
-- Requires: a populated `events` table with representative data.
-- Tip: seed with at least 100k rows for meaningful results.

-- ─── Seed helper (optional) ───────────────────────────────────────────────────
-- INSERT INTO events (group_id, member_address, event_type, amount, cycle,
--                     ledger_sequence, transaction_hash, created_at)
-- SELECT
--     (random() * 999 + 1)::BIGINT,
--     'G' || substr(md5(random()::text), 1, 55),
--     (ARRAY['ContributionMade','PayoutExecuted','MemberJoined','GroupCreated'])[ceil(random()*4)::int],
--     (random() * 10000)::NUMERIC(20,7),
--     (random() * 11 + 1)::INTEGER,
--     (random() * 1000000)::BIGINT,
--     md5(random()::text),
--     NOW() - (random() * INTERVAL '365 days')
-- FROM generate_series(1, 100000);

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 1: Cycle analytics  (group_id, event_type, created_at)
-- ─────────────────────────────────────────────────────────────────────────────

-- BEFORE (sequential scan expected without index)
EXPLAIN ANALYZE
SELECT group_id, event_type, created_at, amount, cycle
FROM   events
WHERE  group_id   = 42
  AND  event_type = 'ContributionMade'
  AND  created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- AFTER (index scan expected on idx_events_cycle_analytics)
-- Run the same query again after migration — output should show:
--   "Index Scan using idx_events_cycle_analytics on events"
EXPLAIN ANALYZE
SELECT group_id, event_type, created_at, amount, cycle
FROM   events
WHERE  group_id   = 42
  AND  event_type = 'ContributionMade'
  AND  created_at >= NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 2: Member history  (member_address, event_type)
-- ─────────────────────────────────────────────────────────────────────────────

-- BEFORE (sequential scan expected without index)
EXPLAIN ANALYZE
SELECT member_address, event_type, created_at, amount, group_id
FROM   events
WHERE  member_address = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  AND  event_type     = 'PayoutExecuted'
ORDER BY created_at DESC;

-- AFTER (index scan expected on idx_events_member_history)
-- Run the same query again after migration — output should show:
--   "Index Scan using idx_events_member_history on events"
EXPLAIN ANALYZE
SELECT member_address, event_type, created_at, amount, group_id
FROM   events
WHERE  member_address = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'
  AND  event_type     = 'PayoutExecuted'
ORDER BY created_at DESC;

-- ═════════════════════════════════════════════════════════════════════════════
-- Issue #42 — queries covered by 002_add_missing_indexes.sql
-- Run each block BEFORE applying 002 (seq scan / sort expected) and AFTER
-- (index scan expected). Compare Planning Time + Execution Time.
-- ═════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 3: Indexer idempotency check  ->  idx_events_transaction_hash
-- ─────────────────────────────────────────────────────────────────────────────
EXPLAIN ANALYZE
SELECT 1
FROM   events
WHERE  transaction_hash = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f901'
LIMIT  1;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 4: Indexer resume-from-ledger / reorg scan  ->  idx_events_ledger_sequence
-- ─────────────────────────────────────────────────────────────────────────────
EXPLAIN ANALYZE
SELECT id, group_id, event_type, ledger_sequence, transaction_hash
FROM   events
WHERE  ledger_sequence >= 900000
ORDER BY ledger_sequence ASC
LIMIT  500;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 5: Per-group cycle payout lookup  ->  idx_events_group_cycle
-- ─────────────────────────────────────────────────────────────────────────────
EXPLAIN ANALYZE
SELECT member_address, event_type, amount, created_at
FROM   events
WHERE  group_id = 42
  AND  cycle    = 7;

-- ─────────────────────────────────────────────────────────────────────────────
-- QUERY 6: Platform-wide activity feed  ->  idx_events_type_created
-- ─────────────────────────────────────────────────────────────────────────────
EXPLAIN ANALYZE
SELECT group_id, member_address, event_type, amount, created_at
FROM   events
WHERE  event_type = 'ContributionMade'
ORDER BY created_at DESC
LIMIT  100;
