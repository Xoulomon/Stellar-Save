# Database index review (issue #42)

Scope: the off-chain `events` table defined in
`database/migrations/001_create_events_table.sql`, which powers analytics,
leaderboards, and the contract-event indexer.

The Prisma-managed schema (`backend/prisma/schema.prisma`) was reviewed
separately and is already densely indexed — every model carries `@@index`
entries on its foreign-key-like columns (`userId`, `groupId`, `walletAddress`,
`address`, …) and on `createdAt`. No gaps were found there, so this review adds
no Prisma migration.

## Method

1. Enumerated the read paths that hit `events`:
   - analytics dashboard (cycle analytics, member history) — already covered by
     `idx_events_cycle_analytics` and `idx_events_member_history` from 001.
   - contract-event indexer: idempotency check per polled event, and a
     resume-from-ledger / reorg range scan on startup.
   - cycle-close / payout logic: "all events for group G in cycle C".
   - admin activity feed: "recent events of type T across all groups".
2. Checked each predicate against the existing indexes. A composite index only
   helps when the query constrains a **prefix** of its columns, so
   `(group_id, event_type, created_at)` does nothing for a query keyed on
   `transaction_hash`, `ledger_sequence`, `cycle`, or `event_type` alone.
3. Added one index per uncovered shape in
   `database/migrations/002_add_missing_indexes.sql`.

## Indexes added by migration 002

| Index | Columns | Query it serves | Plan before → after |
|---|---|---|---|
| `idx_events_transaction_hash` | `(transaction_hash)` | Indexer idempotency: `WHERE transaction_hash = $1 LIMIT 1` on every polled event | Seq Scan on `events` → Index Scan (single row) |
| `idx_events_ledger_sequence` | `(ledger_sequence)` | Indexer resume / reorg: `WHERE ledger_sequence >= $1 ORDER BY ledger_sequence LIMIT 500` | Seq Scan + Sort → Index Scan, no sort |
| `idx_events_group_cycle` | `(group_id, cycle)` | Payout: `WHERE group_id = $1 AND cycle = $2` | Seq Scan (or partial use of `idx_events_cycle_analytics` + filter) → Index Scan |
| `idx_events_type_created` | `(event_type, created_at DESC)` | Activity feed: `WHERE event_type = $1 ORDER BY created_at DESC LIMIT 100` | Seq Scan + Top-N Sort → Index Scan, no sort |

All four are plain B-tree indexes, `CREATE INDEX IF NOT EXISTS`, wrapped in a
transaction, and additive — rollback is four `DROP INDEX IF EXISTS` statements
(listed at the bottom of the migration).

## Verifying the improvement

`database/benchmarks/explain_analyze_indexes.sql` contains `EXPLAIN ANALYZE`
blocks for QUERY 3–6 matching the four shapes above. Procedure:

1. Seed `events` with representative volume (the file's seed helper generates
   100k rows; use ≥100k for a meaningful planner decision).
2. Run QUERY 3–6 **before** applying `002` and record `Planning Time` +
   `Execution Time` and the chosen plan node.
3. Apply `database/migrations/002_add_missing_indexes.sql`.
4. Re-run QUERY 3–6. Expect the plan to switch from `Seq Scan`
   (often with a `Sort` / `Top-N heapsort` node) to `Index Scan` /
   `Index Only Scan` using the named index, and execution time to drop by
   roughly two orders of magnitude at 100k+ rows.

> Note: the numeric before/after figures must be produced against a populated
> database; this review documents the expected plan transitions, and the
> benchmark file is the harness to confirm them in an environment with Postgres.
