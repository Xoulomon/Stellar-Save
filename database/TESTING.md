# Database Migration Testing Guide

Quick start guide for testing database migrations locally.

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ and npm
- PostgreSQL client (`psql`) - optional, for bash tests

## Quick Start

```bash
# 1. Navigate to database directory
cd database

# 2. Install dependencies
npm install

# 3. Start test database
npm run db:up

# 4. Run all tests
npm test

# 5. Clean up
npm run db:down
```

## Available Commands

### Database Management

```bash
npm run db:up      # Start PostgreSQL test database
npm run db:down    # Stop and remove test database
npm run db:logs    # View database logs
npm run db:shell   # Open psql shell to test database
```

### Running Tests

```bash
npm test                     # Run all Jest tests
npm run test:watch           # Run tests in watch mode
npm run test:coverage        # Run tests with coverage report
npm run test:migrations      # Run migration tests only
npm run test:migrations:bash # Run bash script tests
```

## Test Database Connection

The test database runs on:
- **Host:** localhost
- **Port:** 5433 (to avoid conflicts)
- **Database:** stellar_save_test
- **User:** postgres
- **Password:** postgres

Connection string:
```
postgresql://postgres:postgres@localhost:5433/stellar_save_test
```

## What Gets Tested

### Jest Integration Tests
- ✅ Migration files exist and follow naming conventions
- ✅ All migrations have down migrations
- ✅ Migrations apply successfully
- ✅ Migrations are idempotent
- ✅ Migrations roll back cleanly
- ✅ Database state is correct after apply/rollback
- ✅ Data is preserved during rollback
- ✅ Full migration cycles work

### Bash Script Tests
- ✅ Each migration applies without errors
- ✅ Each migration rolls back without errors
- ✅ Missing down migrations are detected

## Troubleshooting

### Port 5433 already in use

```bash
# Check what's using the port
lsof -i :5433

# Stop conflicting service or change port in docker-compose.test.yml
```

### Can't connect to database

```bash
# Check if container is running
docker ps

# Check container logs
npm run db:logs

# Restart database
npm run db:down
npm run db:up
```

### Tests fail with timeout

```bash
# Database might be slow to start
# Wait a few seconds after db:up before running tests

# Or increase timeout in jest.config.js
```

### Permission denied on test-migrations.sh

```bash
# Make script executable (Linux/Mac)
chmod +x test-migrations.sh

# Or run with bash explicitly
bash test-migrations.sh
```

## CI/CD

Tests run automatically on GitHub Actions when:
- Pushing to main/develop branches
- Opening/updating pull requests
- Modifying migration files

See `.github/workflows/database-migrations.yml` for details.

## More Information

- [Migration Conventions](MIGRATION_CONVENTIONS.md) - Comprehensive guide
- [Database README](README.md) - Database structure overview
- [Issue #1557](https://github.com/Xoulomon/Stellar-Save/issues/1557) - Original issue
