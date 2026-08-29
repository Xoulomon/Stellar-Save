# Database Migration Conventions

**Related to:** Issue #1557, Issue #5  
**Last Updated:** 2024

This document establishes conventions for creating, testing, and managing database migrations in the Stellar-Save project.

---

## Table of Contents

- [Overview](#overview)
- [File Naming](#file-naming)
- [Migration Structure](#migration-structure)
- [Rollback Requirements](#rollback-requirements)
- [Testing Requirements](#testing-requirements)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

Database migrations in Stellar-Save follow these principles:

1. **Every migration MUST have a rollback** (down migration)
2. **Migrations MUST be idempotent** (safe to run multiple times)
3. **Migrations MUST be tested** before merging to main
4. **Migrations MUST NOT break existing deployments** (backward compatible)

We maintain two migration systems:

- **SQL Migrations** (`database/migrations/`) - For the events indexing table (raw PostgreSQL)
- **Prisma Migrations** (`backend/prisma/migrations/`) - For application models (Prisma ORM)

This guide focuses on SQL migrations. For Prisma migrations, see [backend/README.md](../backend/README.md).

---

## File Naming

### Migration Files

Pattern: `NNN_short_description.sql`

- `NNN` - Three-digit sequential number (001, 002, 003, ...)
- `short_description` - Lowercase with underscores, describes what the migration does
- `.sql` - SQL file extension

**Examples:**
```
001_create_events_table.sql
002_add_missing_indexes.sql
003_add_group_status_column.sql
```

### Rollback Files

Pattern: `NNN_short_description.down.sql`

- Same base name as the up migration
- `.down.sql` suffix to indicate rollback

**Examples:**
```
001_create_events_table.down.sql
002_add_missing_indexes.down.sql
003_add_group_status_column.down.sql
```

### Template File

`000_template.sql` - Starting template for new migrations (not applied)

---

## Migration Structure

Every migration file MUST follow this structure:

```sql
-- =============================================================================
-- Migration: NNN_description.sql
-- Issue: #ISSUE_NUMBER
-- Description: Brief explanation of what this migration does
-- =============================================================================
--
-- Apply:  psql -U <user> -d <dbname> -f database/migrations/NNN_description.sql
--
-- Dependencies: List any migrations that must be applied first
-- =============================================================================

BEGIN;

-- ─── UP MIGRATION ─────────────────────────────────────────────────────────────
-- All DDL statements to apply the migration
-- Use IF NOT EXISTS / IF EXISTS for idempotency

CREATE TABLE IF NOT EXISTS example (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_example_name ON example (name);

-- ─── COMMENTS ──────────────────────────────────────────────────────────────────
-- Document the purpose of tables and indexes

COMMENT ON TABLE example IS 'Description of table purpose';
COMMENT ON INDEX idx_example_name IS 'Description of index purpose';

COMMIT;

-- ─── DOWN MIGRATION (Rollback) ────────────────────────────────────────────────
-- Instructions for rolling back this migration
-- To rollback: psql -U <user> -d <dbname> -f database/migrations/NNN_description.down.sql
--
-- Or manually execute:
--   DROP INDEX IF EXISTS idx_example_name;
--   DROP TABLE IF EXISTS example;
```

---

## Rollback Requirements

### Every Migration MUST Have a Rollback

**Required Files:**
- `NNN_description.sql` (up migration)
- `NNN_description.down.sql` (down migration)

**Rollback File Structure:**

```sql
-- =============================================================================
-- Migration Rollback: NNN_description.down.sql
-- Rolls back changes made in NNN_description.sql
-- =============================================================================
--
-- WARNING: [Describe data loss or impacts]
--
-- Rollback: psql -U <user> -d <dbname> -f database/migrations/NNN_description.down.sql
-- =============================================================================

BEGIN;

-- Drop objects in reverse order of creation
-- Drop dependent objects first (indexes, constraints, then tables)

DROP INDEX IF EXISTS idx_example_name;
DROP TABLE IF EXISTS example;

COMMIT;
```

### Rollback Order

When rolling back multiple migrations, execute in **reverse order**:

```bash
# Wrong order (will fail)
psql -f 001_create_table.down.sql
psql -f 002_add_indexes.down.sql

# Correct order
psql -f 002_add_indexes.down.sql  # Latest migration first
psql -f 001_create_table.down.sql # Earlier migration last
```

### Rollback Safety

**Safe Rollbacks (Data Preserved):**
- Dropping indexes
- Removing constraints
- Dropping views

**Destructive Rollbacks (Data Lost):**
- Dropping tables
- Dropping columns
- Truncating data

For destructive rollbacks, include a **WARNING** in the down migration file explaining the impact.

---

## Testing Requirements

### Automated Tests

All migrations MUST pass automated tests before merging:

**Bash Script Test:**
```bash
# Start test database
docker-compose -f database/docker-compose.test.yml up -d

# Run migration tests
./database/test-migrations.sh

# Clean up
docker-compose -f database/docker-compose.test.yml down -v
```

**Jest Integration Test:**
```bash
# In database/ directory
npm install
npm run db:up
npm test
npm run db:down
```

### Test Coverage

Each migration must be tested for:

1. ✅ **Apply successfully** - Migration runs without errors
2. ✅ **Idempotent** - Can be run multiple times safely
3. ✅ **Rollback cleanly** - Down migration restores previous state
4. ✅ **Data preservation** - Existing data not lost (unless intended)
5. ✅ **Full cycle** - Apply → Rollback → Reapply works correctly

### Manual Testing Checklist

Before merging a new migration:

- [ ] Migration file follows naming convention
- [ ] Down migration file exists
- [ ] Both files have proper header comments
- [ ] Migration uses IF NOT EXISTS / IF EXISTS for idempotency
- [ ] Comments added for tables and indexes
- [ ] Automated tests pass
- [ ] Manual apply/rollback tested on local database
- [ ] Reviewed by at least one other developer

---

## Best Practices

### 1. Use Transactions

Always wrap migrations in `BEGIN` / `COMMIT`:

```sql
BEGIN;
-- Migration statements
COMMIT;
```

**Benefits:**
- Atomic operations (all or nothing)
- Easier to debug failures
- Rollback on error

### 2. Make Migrations Idempotent

Use conditional DDL statements:

```sql
-- ✅ Good - Idempotent
CREATE TABLE IF NOT EXISTS events (...);
CREATE INDEX IF NOT EXISTS idx_events_type ON events (event_type);
DROP TABLE IF EXISTS old_table;

-- ❌ Bad - Will fail on second run
CREATE TABLE events (...);
CREATE INDEX idx_events_type ON events (event_type);
DROP TABLE old_table;
```

### 3. Document Everything

Add comments explaining:
- Why the migration is needed (link to issue)
- What each change does
- Any dependencies on other migrations
- Risks or impacts of rollback

### 4. Order Matters

Within a migration, order operations carefully:

```sql
-- ✅ Correct order
CREATE TABLE parent (...);
CREATE TABLE child (
    parent_id BIGINT REFERENCES parent(id)
);

-- ❌ Wrong order - will fail
CREATE TABLE child (
    parent_id BIGINT REFERENCES parent(id)
);
CREATE TABLE parent (...);
```

For rollbacks, reverse the order:

```sql
-- ✅ Correct rollback order
DROP TABLE child;   -- Drop dependent table first
DROP TABLE parent;  -- Drop parent table last
```

### 5. Test Data Migrations Carefully

If your migration modifies data:

```sql
-- Example: Backfill default values
UPDATE events SET status = 'active' WHERE status IS NULL;
```

**Requirements:**
- Test with production-like data volume
- Verify performance (use EXPLAIN ANALYZE)
- Consider batching for large tables
- Document expected duration

### 6. Avoid Long-Running Migrations

Migrations that take >1 minute to run can cause deployment issues.

**For Long Operations:**
- Use `CREATE INDEX CONCURRENTLY` (cannot be in transaction)
- Batch large UPDATE operations
- Consider background jobs instead of migrations

### 7. Never Modify Applied Migrations

Once a migration is merged to `main` and applied to any environment:

- ❌ **DO NOT** edit the migration file
- ❌ **DO NOT** delete the migration
- ❌ **DO NOT** change the migration number

**Instead:** Create a new migration to make changes.

---

## Examples

### Example 1: Creating a Table with Indexes

**File:** `003_create_notifications_table.sql`

```sql
-- =============================================================================
-- Migration: 003_create_notifications_table.sql
-- Issue: #557
-- Description: Creates notifications table for user notification preferences
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(56) NOT NULL,
    notification_type VARCHAR(64) NOT NULL,
    message TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id 
    ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_read_status 
    ON notifications (user_id, read_at) 
    WHERE read_at IS NULL;

COMMENT ON TABLE notifications IS 'User notification messages and read status';
COMMENT ON INDEX idx_notifications_user_id IS 'User notification history lookup';
COMMENT ON INDEX idx_notifications_read_status IS 'Unread notifications lookup (partial index)';

COMMIT;
```

**File:** `003_create_notifications_table.down.sql`

```sql
-- =============================================================================
-- Migration Rollback: 003_create_notifications_table.down.sql
-- =============================================================================
-- WARNING: This will drop the notifications table and all notification data.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_notifications_read_status;
DROP INDEX IF EXISTS idx_notifications_user_id;
DROP TABLE IF EXISTS notifications;

COMMIT;
```

### Example 2: Adding a Column

**File:** `004_add_group_status_column.sql`

```sql
-- =============================================================================
-- Migration: 004_add_group_status_column.sql
-- Issue: #123
-- Description: Adds status column to events table for group lifecycle tracking
-- Dependencies: 001_create_events_table.sql
-- =============================================================================

BEGIN;

-- Add column if it doesn't exist
ALTER TABLE events 
    ADD COLUMN IF NOT EXISTS group_status VARCHAR(32);

-- Backfill existing rows with default value
UPDATE events 
    SET group_status = 'active' 
    WHERE group_status IS NULL;

-- Add NOT NULL constraint after backfill
ALTER TABLE events 
    ALTER COLUMN group_status SET NOT NULL;

-- Add check constraint
ALTER TABLE events 
    ADD CONSTRAINT check_group_status 
    CHECK (group_status IN ('pending', 'active', 'completed', 'cancelled'));

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_events_group_status 
    ON events (group_status, created_at DESC);

COMMENT ON COLUMN events.group_status IS 'Current status of the group (pending/active/completed/cancelled)';

COMMIT;
```

**File:** `004_add_group_status_column.down.sql`

```sql
-- =============================================================================
-- Migration Rollback: 004_add_group_status_column.down.sql
-- =============================================================================
-- WARNING: This will remove the group_status column and all status data.
-- =============================================================================

BEGIN;

DROP INDEX IF EXISTS idx_events_group_status;
ALTER TABLE events DROP CONSTRAINT IF EXISTS check_group_status;
ALTER TABLE events DROP COLUMN IF EXISTS group_status;

COMMIT;
```

### Example 3: Modifying an Index

**File:** `005_optimize_event_lookup_index.sql`

```sql
-- =============================================================================
-- Migration: 005_optimize_event_lookup_index.sql
-- Issue: #200
-- Description: Replaces idx_events_type_created with more selective index
-- Dependencies: 002_add_missing_indexes.sql
-- =============================================================================

BEGIN;

-- Drop old index
DROP INDEX IF EXISTS idx_events_type_created;

-- Create new optimized index with additional column
CREATE INDEX IF NOT EXISTS idx_events_type_group_created 
    ON events (event_type, group_id, created_at DESC);

COMMENT ON INDEX idx_events_type_group_created IS 'Optimized activity feed lookup with group filter';

COMMIT;
```

**File:** `005_optimize_event_lookup_index.down.sql`

```sql
-- =============================================================================
-- Migration Rollback: 005_optimize_event_lookup_index.down.sql
-- =============================================================================

BEGIN;

-- Restore original index
CREATE INDEX IF NOT EXISTS idx_events_type_created 
    ON events (event_type, created_at DESC);

-- Drop new index
DROP INDEX IF EXISTS idx_events_type_group_created;

COMMIT;
```

---

## Quick Reference

### Creating a New Migration

1. Copy template:
   ```bash
   cp database/migrations/000_template.sql database/migrations/00X_your_description.sql
   ```

2. Fill in migration details

3. Create down migration:
   ```bash
   cp database/migrations/000_template.sql database/migrations/00X_your_description.down.sql
   ```

4. Fill in rollback steps

5. Test migration:
   ```bash
   npm run db:up
   npm test
   npm run db:down
   ```

6. Add to version control and create PR

### Running Migrations

**Apply a specific migration:**
```bash
psql -U postgres -d stellar_save -f database/migrations/001_create_events_table.sql
```

**Rollback a specific migration:**
```bash
psql -U postgres -d stellar_save -f database/migrations/001_create_events_table.down.sql
```

**Test all migrations:**
```bash
./database/test-migrations.sh
```

**Run Jest tests:**
```bash
cd database
npm test
```

---

## Related Documentation

- [Database README](README.md) - Database structure overview
- [Index Review](INDEX_REVIEW.md) - Index optimization rationale
- [Backend README](../backend/README.md) - Prisma migrations
- [Issue #1557](https://github.com/Xoulomon/Stellar-Save/issues/1557) - Migration rollback tests
- [Issue #5](https://github.com/Xoulomon/Stellar-Save/issues/5) - Migration conventions

---

## Support

For questions about migrations:
- Check existing migrations in `database/migrations/` for examples
- Review this conventions guide
- Ask in the #database channel on Discord
- Create a discussion on GitHub

---

**Remember:** Well-tested migrations prevent production incidents! 🛡️
