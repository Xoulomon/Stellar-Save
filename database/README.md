# Database

Off-chain PostgreSQL layer for indexing Soroban contract events to power the analytics dashboard.

## Structure

```
database/
├── INDEX_REVIEW.md                       # index review rationale (issue #42)
├── migrations/
│   ├── 001_create_events_table.sql       # events table + analytics indexes
│   └── 002_add_missing_indexes.sql       # indexer / payout / feed indexes (#42)
└── benchmarks/
    └── explain_analyze_indexes.sql       # EXPLAIN ANALYZE before/after comparison
```

## Applying the migration

```bash
psql -U <user> -d <dbname> -f database/migrations/001_create_events_table.sql
psql -U <user> -d <dbname> -f database/migrations/002_add_missing_indexes.sql
```

See `INDEX_REVIEW.md` for the rationale behind each index in `002`.

## Running benchmarks

Seed the table first (see the seed helper comment in the benchmark file), then:

```bash
psql -U <user> -d <dbname> -f database/benchmarks/explain_analyze_indexes.sql
```

Compare `Planning Time` and `Execution Time` in the output before and after the migration.
