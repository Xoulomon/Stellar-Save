/**
 * Integration test global setup/teardown.
 *
 * Expects the test DB to be running (via docker-compose.test.yml) before
 * the suite starts. The DATABASE_URL env var is set here so every test
 * module picks it up before importing Prisma.
 *
 * Run order:
 *   1. docker compose -f test/docker-compose.test.yml up -d
 *   2. npx prisma migrate deploy (against TEST_DATABASE_URL)
 *   3. npm run test:integration
 */

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  'postgresql://test:test@localhost:5433/stellar_save_test';

// Set before any module is imported so Prisma picks up the right URL.
process.env.DATABASE_URL = TEST_DATABASE_URL;

// Silence noisy middleware (rate-limiter Redis, logger) during tests.
process.env.REDIS_HOST = process.env.REDIS_HOST || '';
process.env.NODE_ENV = 'test';
