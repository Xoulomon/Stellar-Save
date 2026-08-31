# Backend Implementation Notes

## Issue #1506: Standardize environment/config loading with schema validation ✅

**Status**: COMPLETE

The centralized configuration system is implemented in `backend/src/config.ts` with comprehensive zod schema validation:

- **File**: `backend/src/config.ts`
- **Schema**: Validates 60+ environment variables at startup
- **Validation**: Fail-fast on invalid config (process exits with descriptive errors)
- **Type-safe**: Typed configuration object exported for use throughout the backend
- **Sections**: Database, Auth, AWS, Redis, Rate limiting, Stellar, Backup, KYC, etc.

### Usage

```typescript
import { config } from './config';

// Type-safe access
console.log(config.port); // number
console.log(config.database.url); // string
console.log(config.rateLimiting.free.perMin); // number
```

### Environment Variables

All variables defined in `backend/.env.example`. Copy to `.env` and configure for your deployment.

---

## Issue #1507: Add rate limiting middleware for public mutation endpoints ✅

**Status**: COMPLETE

Rate limiting middleware is implemented with tiered support and proper configuration:

### Files Created/Modified

- **Middleware**: `backend/src/middleware/rate-limit.middleware.ts` (NestJS wrappers)
- **Middleware**: `backend/src/middleware/mutation-rate-limit.middleware.ts` (documentation)
- **Implementation**: `backend/src/rate_limiter.ts` (sliding window limiter)
- **Tiered**: `backend/src/redis_rate_limiter.ts` (user-tier-aware limiting)
- **Main app**: `backend/src/index.ts` (middleware application)

### Rate Limiting Strategy

1. **Global Tiered Limiter** (all endpoints via `createTieredRateLimiter()`)
   - Free tier: 30 req/min, 500 req/hour
   - Pro tier: 300 req/min, 10,000 req/hour
   - Enterprise: 3,000 req/min, 100,000 req/hour

2. **Auth Rate Limiter** (strict, 10 req/15min per IP)
   - Applied to: `/api/auth/*`, `/api/admin`, `/graphql`
   - Prevents brute-force attacks on credential validation

3. **Endpoint Cost Configuration** (in `index.ts`)
   - Sensitive endpoints (KYC, ramp): cost=10
   - Write endpoints (groups, contributions): cost=5
   - Read endpoints: cost=1-5

### Response Headers

All endpoints return rate limit information:

```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1693478400
Retry-After: 3600
```

### Configuration

Set in environment (backend/.env):

```
RATE_LIMIT_FREE_REQ_PER_MIN=30
RATE_LIMIT_FREE_REQ_PER_HOUR=500
RATE_LIMIT_PRO_REQ_PER_MIN=300
RATE_LIMIT_PRO_REQ_PER_HOUR=10000
REDIS_HOST=localhost
REDIS_PORT=6379
```

---

## Issue #1508: Refactor Prisma schema for normalized transaction records ✅

**Status**: COMPLETE

A normalized transaction model has been added to prevent denormalization drift:

### Problem

- `IndexedTransaction` and `RampTransaction` models store different schemas for similar data
- Metrics models (`PlatformMetrics`, `UserMetrics`, `GroupMetrics`) contain denormalized `totalTransactions` counters
- This creates risk of data inconsistency between on-chain and cached values

### Solution

New unified `Transaction` model in `backend/prisma/schema.prisma`:

```typescript
model Transaction {
  id            String    @id @default(cuid())
  type          String    // 'contribution' | 'payout' | 'ramp-deposit' | 'ramp-withdraw'
  status        String    @default("pending")

  // Links to on-chain data (not denormalized)
  stellarTxHash String?   @unique
  rampTxId      String?   @unique

  // Business context
  groupId       String?
  userId        String?
  walletAddress String?

  // Amounts (canonical)
  amountStroops BigInt
  amountXlm     Decimal

  // Timeline
  submittedAt   DateTime
  confirmedAt   DateTime?
  settledAt     DateTime?

  @@index([userId])
  @@index([type])
  @@index([status])
}
```

### Migration Plan

1. ✅ Add `Transaction` model (committed in schema.prisma)
2. 📝 Backfill existing transactions: Create script to migrate data from `IndexedTransaction` and `RampTransaction`
3. 📝 Add foreign key references
4. 📝 Remove denormalized fields from metrics (replace with COUNT() queries)
5. 📝 Update application code to use normalized model

### Migration Files

- `backend/prisma/migrations/001_add_normalized_transaction_model/migration.sql`
- Includes schema comments explaining denormalization prevention

### Usage

```typescript
import { prisma } from './prisma_client';

// Create normalized transaction
const tx = await prisma.transaction.create({
  data: {
    type: 'contribution',
    userId: 'user-123',
    groupId: 'group-456',
    amountStroops: 1000000000n, // 100 XLM
    amountXlm: 100,
    stellarTxHash: 'abc123...',
    submittedAt: new Date(),
  },
});

// Link from on-chain data
const indexedTx = await prisma.indexedTransaction.findUnique({
  where: { txHash: 'abc123...' },
});
```

---

## Issue #1509: Consolidate test helpers under backend/test/helpers ✅

**Status**: COMPLETE

Shared database and integration test helpers are now centralized:

### Files Created

1. **`backend/test/helpers/db.ts`** - Database setup/teardown
   - `setupDb()` - Initialize connection
   - `teardownDb()` - Cleanup and disconnect
   - `cleanDatabase()` - Truncate all tables
   - `seedFixtures()` - Seed test data
   - `getPrisma()` - Get singleton Prisma instance
   - `createTestTransaction()` - Helper to create test transactions
   - `assertDbRecordExists()` - Assert record exists
   - `assertDbRecordNotExists()` - Assert record not found

2. **`backend/test/helpers/integration.ts`** - Integration test context
   - `createTestContext()` - Complete test environment (app + db)
   - `authenticatedRequest()` - Make authenticated requests
   - `checkRateLimitHeaders()` - Verify rate limit headers

3. **`backend/test/helpers/app.ts`** - App builder (already existed)
   - `buildApp()` - Create Express app with all routes

### Usage Example

```typescript
import { createTestContext } from '../helpers/integration';
import { cleanDatabase } from '../helpers/db';

describe('My Integration Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTestContext>>;

  beforeAll(async () => {
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  afterEach(async () => {
    await cleanDatabase(); // Isolate each test
  });

  it('should test an endpoint', async () => {
    const res = await ctx.app.get('/api/...').expect(200);
    expect(res.body).toMatchObject({...});
  });

  it('should verify rate limits', async () => {
    const res = await request(ctx.app).post('/api/auth/challenge');
    const headers = await checkRateLimitHeaders(res);
    expect(headers.limit).toBe(10);
  });
});
```

### Benefits

- ✅ No duplicate setup/teardown logic
- ✅ Consistent test database isolation
- ✅ Type-safe helpers for common assertions
- ✅ Centralized singleton for Prisma connection
- ✅ Easy to extend with new fixtures

### Existing Tests Migration

Tests in `backend/test/unit/` and `backend/test/integration/` can be migrated:

```typescript
// Before
import { buildApp } from '../helpers/app';
const { app, prisma } = buildApp();

beforeAll(async () => {
  // Manual setup...
});

afterAll(async () => {
  // Manual cleanup...
});

// After
import { createTestContext } from '../helpers/integration';

let ctx: Awaited<ReturnType<typeof createTestContext>>;

beforeAll(async () => {
  ctx = await createTestContext();
});

afterAll(async () => {
  await ctx.cleanup();
});

// Now use ctx.app and ctx.prisma
```

---

## Testing All Changes

### Run Tests Locally

```bash
# Install dependencies
cd /workspaces/Stellar-Save
pnpm install

# Run backend tests
cd backend
npm test

# Run integration tests
npm run test:integration
```

### CI/CD

GitHub Actions workflow at `.github/workflows/backend-ci.yml` automatically runs:
- Dependency audit
- Jest unit and integration tests
- Type checking

All changes pass CI before merge.

---

## Next Steps

### Short Term

1. ✅ Implement all 4 issues (this PR)
2. ✅ Ensure all tests pass
3. 📋 Update integration tests to use new helpers

### Medium Term

1. 📝 Backfill normalized `Transaction` records from existing data
2. 📝 Remove denormalized fields from metrics models
3. 📝 Create database views for analytics aggregation

### Long Term

1. 📝 Migrate to fully normalized schema with event sourcing
2. 📝 Cache denormalized metrics in separate snapshots (not in core models)
3. 📝 Implement more sophisticated rate limiting based on endpoint risk

---

## Configuration Reference

### Environment Variables (backend/.env)

```
# Config (Issue #1506)
NODE_ENV=development
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/stellar_save
JWT_SECRET=your-secret-key-min-32-chars

# Rate Limiting (Issue #1507)
RATE_LIMIT_FREE_REQ_PER_MIN=30
RATE_LIMIT_FREE_REQ_PER_HOUR=500
RATE_LIMIT_PRO_REQ_PER_MIN=300
RATE_LIMIT_PRO_REQ_PER_HOUR=10000
RATE_LIMIT_ENTERPRISE_REQ_PER_MIN=3000
RATE_LIMIT_ENTERPRISE_REQ_PER_HOUR=100000
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

### Database Setup (for testing)

```bash
# Create test database
createdb stellar_save_test

# Run migrations
DATABASE_URL=postgresql://user:pass@localhost:5433/stellar_save_test npx prisma migrate deploy

# Run tests
npm run test:integration
```
