# Database

Off-chain PostgreSQL layer for indexing Soroban contract events to power the analytics dashboard.

## Structure

```
database/
├── migrations/
│   └── 001_create_events_table.sql   # events table + analytics indexes
└── benchmarks/
    └── explain_analyze_indexes.sql   # EXPLAIN ANALYZE before/after comparison
```

## Applying the migration

```bash
psql -U <user> -d <dbname> -f database/migrations/001_create_events_table.sql
```

## Running benchmarks

Seed the table first (see the seed helper comment in the benchmark file), then:

```bash
psql -U <user> -d <dbname> -f database/benchmarks/explain_analyze_indexes.sql
```

Compare `Planning Time` and `Execution Time` in the output before and after the migration.
