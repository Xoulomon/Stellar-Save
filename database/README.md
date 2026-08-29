# Database

Off-chain PostgreSQL layer for indexing Soroban contract events to power the analytics dashboard.

## Structure

```
database/
├── MIGRATION_CONVENTIONS.md              # Migration best practices (Issue #5, #1557)
├── INDEX_REVIEW.md                       # Index review rationale (Issue #42)
├── migrations/
│   ├── 000_template.sql                  # Migration template
│   ├── 001_create_events_table.sql       # Events table + analytics indexes
│   ├── 001_create_events_table.down.sql  # Rollback for 001
│   ├── 002_add_missing_indexes.sql       # Indexer / payout / feed indexes (#42)
│   └── 002_add_missing_indexes.down.sql  # Rollback for 002
├── benchmarks/
│   └── explain_analyze_indexes.sql       # EXPLAIN ANALYZE before/after comparison
├── test-migrations.sh                    # Automated rollback test script (#1557)
├── migrations.test.ts                    # Jest integration tests (#1557)
├── docker-compose.test.yml               # Test database configuration
└── package.json                          # Test dependencies and scripts
```

## Migration Conventions

**Important:** Every migration MUST have a corresponding `.down.sql` rollback file!

See [MIGRATION_CONVENTIONS.md](MIGRATION_CONVENTIONS.md) for detailed guidelines on:
- File naming patterns
- Migration structure requirements
- Rollback best practices
- Testing requirements
- Examples

## Applying Migrations

```bash
psql -U <user> -d <dbname> -f database/migrations/001_create_events_table.sql
psql -U <user> -d <dbname> -f database/migrations/002_add_missing_indexes.sql
```

## Rolling Back Migrations

```bash
# Rollback in reverse order
psql -U <user> -d <dbname> -f database/migrations/002_add_missing_indexes.down.sql
psql -U <user> -d <dbname> -f database/migrations/001_create_events_table.down.sql
```

## Testing Migrations

### Automated Rollback Tests (Issue #1557)

**Bash Script Test:**
```bash
# Start test database
docker-compose -f database/docker-compose.test.yml up -d

# Run migration tests
./database/test-migrations.sh

# Clean up
docker-compose -f database/docker-compose.test.yml down -v
```

**Jest Integration Tests:**
```bash
cd database
npm install
npm run db:up
npm test
npm run db:down
```

**Available npm scripts:**
```bash
npm test                    # Run all tests
npm run test:migrations     # Run migration tests only
npm run test:migrations:bash # Run bash script tests
npm run db:up               # Start test database
npm run db:down             # Stop and remove test database
npm run db:logs             # View database logs
npm run db:shell            # Open psql shell to test database
```

See `database/MIGRATION_CONVENTIONS.md` for comprehensive testing guidelines.

## Running Benchmarks

Seed the table first (see the seed helper comment in the benchmark file), then:

```bash
psql -U <user> -d <dbname> -f database/benchmarks/explain_analyze_indexes.sql
```

Compare `Planning Time` and `Execution Time` in the output before and after the migration.

## Related Documentation

- [MIGRATION_CONVENTIONS.md](MIGRATION_CONVENTIONS.md) - Migration guidelines and best practices
- [INDEX_REVIEW.md](INDEX_REVIEW.md) - Index optimization rationale (Issue #42)
- [Issue #1557](https://github.com/Xoulomon/Stellar-Save/issues/1557) - Migration rollback tests
- [Issue #5](https://github.com/Xoulomon/Stellar-Save/issues/5) - Migration conventions
