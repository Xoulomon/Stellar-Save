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
