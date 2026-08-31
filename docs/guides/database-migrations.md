# Database Schema and Migration Conventions Guide

This guide details the conventions, file naming standards, rollback patterns, code review rules, and performance benchmarking practices for managing database migrations in `database/migrations`.

---

## 1. Migration File Naming Conventions

All migration files in `database/migrations/` must follow a strict, sequential timestamp or zero-padded numeric prefix format:

```text
database/migrations/NNN_description.sql
```

Examples:
- `001_create_events_table.sql`
- `002_add_user_preferences_index.sql`

### Naming Rules:
1. **Prefix**: Use zero-padded 3-digit numbers (`001`, `002`) or 14-digit UTC timestamps (`YYYYMMDDHHMMSS`).
2. **Description**: Use snake_case describing the action (e.g. `create_users_table`, `add_index_to_contributions`).
3. **Extension**: `.sql`.

---

## 2. Migration Structure & Rollback Conventions

Every SQL migration file must include both **UP** (forward migration) and **DOWN** (rollback migration) sections, separated by standardized comments, and execute within a single transaction block.

### Mandatory Structure:

```sql
-- Migration: <Title>
-- Description: <Brief description>
-- Author: <Author Name / Team>
-- Date: <YYYY-MM-DD>

BEGIN;

-- =============================================================================
-- UP MIGRATION (Apply Changes)
-- =============================================================================

-- Your ALTER / CREATE / INDEX statements here

-- =============================================================================
-- DOWN MIGRATION (Rollback Changes)
-- =============================================================================
-- Note: Down statements are provided for rollback runbooks.

-- Your DROP / REVERT statements here

COMMIT;
```

---

## 3. Database Benchmarks Usage (`database/benchmarks/`)

Performance-sensitive migrations modifying large tables or adding new indexes must be benchmarked using query execution plans.

- Benchmarks are stored in `database/benchmarks/`.
- Use `EXPLAIN ANALYZE` scripts (such as `database/benchmarks/explain_analyze_indexes.sql`) to capture baseline latency, index hit rates, and scan types before and after running migrations.
- Ensure all new indexes use `CONCURRENTLY` in production environments to prevent locking read/write workloads on active tables.

---

## 4. Migration Review Checklist

Before submitting a migration PR for review:

- [ ] Migration follows the `NNN_description.sql` naming pattern.
- [ ] Contains both UP and DOWN sections.
- [ ] Uses transactional guards (`BEGIN;` ... `COMMIT;`) where appropriate.
- [ ] Includes `database/migrations/000_template.sql` compliance.
- [ ] Benchmarked via `database/benchmarks/` scripts if modifying indexes or tables >100k rows.
