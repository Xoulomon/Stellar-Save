/**
 * Admin API Regression Tests — Issue #1737
 *
 * Locks in the endpoint surface documented in ADMIN_API_CLEANUP.md:
 *
 *   KEPT (7 endpoints):
 *     GET    /admin/stats
 *     GET    /admin/users
 *     PATCH  /admin/users/:id
 *     DELETE /admin/users/:id
 *     GET    /admin/groups
 *     POST   /admin/groups/:id/flag
 *     GET    /admin/audit-logs
 *
 *   REMOVED (5 endpoints — must return 404, not 500 or silent success):
 *     GET    /admin/reconciliation/status
 *     POST   /admin/reconciliation/run
 *     GET    /admin/fraud/flags
 *     PATCH  /admin/fraud/flags/:id
 *     POST   /admin/fraud/scan
 *
 * Strategy: build a minimal Express app that mounts createV1Router() under /v1
 * (exactly as production does), then drive it with supertest.  The
 * adminAuthMiddleware reads process.env.ADMIN_SECRET, so we set that before
 * importing anything and restore it after each suite.
 *
 * Note: ts-jest type-checking is disabled for this file (@ts-nocheck via globals)
 * because several transitively-imported route files (insurance.ts, v1.ts) contain
 * pre-existing TypeScript type errors that would block compilation but do not
 * affect runtime behaviour.  The tests validate HTTP routing behaviour, not types.
 */
// @ts-nocheck

// Set the admin secret before any module is imported so that config.ts picks
// it up during the require()-time evaluation.
const TEST_ADMIN_SECRET = 'test-admin-secret-regression';
process.env.ADMIN_SECRET = TEST_ADMIN_SECRET;
// Silence the analytics/redis modules that are imported transitively.
process.env.REDIS_URL = '';

import express from 'express';
import request from 'supertest';

import { createV1Router } from '../routes/v1';
import { createPrismaMock } from '../../tests/helpers/prismaMock';

// ---------------------------------------------------------------------------
// Module-level mocks — must be declared before describe() blocks
// ---------------------------------------------------------------------------

jest.mock('@prisma/client', () => {
  const { createPrismaMock } = require('../../tests/helpers/prismaMock');
  const mockClient = createPrismaMock();
  mockClient.contractEvent.count.mockResolvedValue(0);
  mockClient.contractEvent.groupBy.mockResolvedValue([]);
  mockClient.contractEvent.findMany.mockResolvedValue([]);
  mockClient.refreshToken.create.mockResolvedValue({});
  mockClient.refreshToken.findUnique.mockResolvedValue(null);
  mockClient.refreshToken.update.mockResolvedValue({});
  mockClient.refreshToken.deleteMany.mockResolvedValue({ count: 0 });
  mockClient.$disconnect.mockResolvedValue(undefined);
  return {
    PrismaClient: jest.fn().mockImplementation(() => mockClient),
    __mockClient: mockClient,
  };
});

// Also mock the prisma_client singleton so it never tries to connect.
jest.mock('../prisma_client', () => ({
  prisma: require('@prisma/client').__mockClient,
  disconnectPrisma: jest.fn().mockResolvedValue(undefined),
}));

// Redis: used by analytics middleware and rate limiter inside the router.
jest.mock('../redis', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  readinessCheckCache: jest.fn().mockResolvedValue({ up: true, latencyMs: 1 }),
}));

// analytics_middleware can try to talk to Redis; stub it out.
jest.mock('../analytics_middleware', () => ({
  createAnalyticsMiddlewareStack: () => ({
    readRateLimit: (_req: any, _res: any, next: any) => next(),
    writeRateLimit: (_req: any, _res: any, next: any) => next(),
    cache: (_req: any, _res: any, next: any) => next(),
  }),
  createAnalyticsCacheMiddleware: () => (_req: any, _res: any, next: any) => next(),
}));

// ---------------------------------------------------------------------------
// Minimal stub services — createV1Router requires a V1Services bag but the
// admin endpoints only use the inline AdminService, so other services just need
// to be present as valid objects.
// ---------------------------------------------------------------------------
const makeStubServices = () => {
  const eventIndexerPrisma = createPrismaMock();
  eventIndexerPrisma.contractEvent.count.mockResolvedValue(0);
  eventIndexerPrisma.contractEvent.groupBy.mockResolvedValue([]);
  eventIndexerPrisma.contractEvent.findMany.mockResolvedValue([]);

  return {
    engine: { setPreference: jest.fn(), getRecommendations: jest.fn().mockReturnValue([]) },
    exportService: {
      createJob: jest.fn().mockResolvedValue('job_1'),
      getJob: jest.fn().mockReturnValue(null),
    },
    backupService: { listJobs: jest.fn().mockReturnValue([]), getJob: jest.fn().mockReturnValue(null) },
    backupScheduler: { triggerManual: jest.fn().mockResolvedValue({}) },
    recoveryService: { restore: jest.fn().mockResolvedValue({}), restoreLatest: jest.fn().mockResolvedValue({}) },
    backupMonitor: { getAlerts: jest.fn().mockReturnValue([]), acknowledge: jest.fn().mockReturnValue(true) },
    backupRestoreDrill: {
      runDrill: jest.fn().mockResolvedValue({}),
      acknowledge: jest.fn().mockReturnValue(true),
    },
    eventIndexer: {
      readinessCheckDatabase: jest.fn().mockResolvedValue({ up: true, latencyMs: 1 }),
      readinessCheckHorizon: jest.fn().mockResolvedValue({ up: true, latencyMs: 1 }),
      getEvents: jest.fn().mockResolvedValue([]),
      prisma: eventIndexerPrisma,
    },
    analyticsService: {
      getPlatformStats: jest.fn().mockResolvedValue({}),
      getGroupsOverviewStats: jest.fn().mockResolvedValue({}),
      getPlatformTrends: jest.fn().mockResolvedValue([]),
      getUserStats: jest.fn().mockResolvedValue(null),
      getGroupStats: jest.fn().mockResolvedValue(null),
      getEventStats: jest.fn().mockResolvedValue([]),
      recordEvent: jest.fn().mockResolvedValue(undefined),
      generateReport: jest.fn().mockResolvedValue({}),
      getReports: jest.fn().mockResolvedValue([]),
      getCacheStats: jest.fn().mockResolvedValue({}),
      clearCache: jest.fn().mockResolvedValue(undefined),
    },
    feedbackService: {},
  } as any;
};

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/v1', createV1Router(makeStubServices()));
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Headers that satisfy adminAuthMiddleware. */
const ADMIN_HEADERS = { 'x-admin-secret': TEST_ADMIN_SECRET };

/** Headers that are deliberately missing the admin secret. */
const NO_AUTH_HEADERS = {};

// ---------------------------------------------------------------------------
// Suite 1 — Endpoint-set assertion
//
// Every documented admin endpoint must respond with something other than 404
// when called with valid admin credentials.  A 401/400/500 would still mean
// the route exists; 404 means it is gone.
// ---------------------------------------------------------------------------

describe('Admin API — documented endpoints are registered', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  const documented: Array<{ method: 'get' | 'patch' | 'delete' | 'post'; path: string; body?: object }> = [
    { method: 'get',    path: '/v1/admin/stats' },
    { method: 'get',    path: '/v1/admin/users' },
    // Use real mock IDs (m1, 1) so these routes respond with 200 rather than
    // a resource-level 404 (which would be ambiguous with a routing 404).
    { method: 'patch',  path: '/v1/admin/users/m1', body: { updates: { name: 'Test' }, adminId: 'admin_001' } },
    { method: 'delete', path: '/v1/admin/users/m2', body: { adminId: 'admin_001' } },
    { method: 'get',    path: '/v1/admin/groups' },
    { method: 'post',   path: '/v1/admin/groups/1/flag', body: { flagged: true, adminId: 'admin_001' } },
    { method: 'get',    path: '/v1/admin/audit-logs' },
  ];

  for (const { method, path, body } of documented) {
    it(`${method.toUpperCase()} ${path} is registered (not 404)`, async () => {
      const req = request(app)[method](path)
        .set(ADMIN_HEADERS)
        .set('Content-Type', 'application/json');

      const res = body ? await req.send(body) : await req;

      // 404 means the route was never registered — that is the failure we guard against.
      // Any other status (200, 400, 401, 404-from-resource, 500) means the route exists.
      expect(res.status).not.toBe(404);
    });
  }
});

// ---------------------------------------------------------------------------
// Suite 2 — Removed endpoints return 404
//
// None of the five deleted endpoints should be reachable.  A 404 response
// (from Express's built-in "cannot find" handler) is the only acceptable answer.
// A 500 would suggest the route still exists but is broken; 200/201 would be
// a regression.
// ---------------------------------------------------------------------------

describe('Admin API — removed endpoints return 404', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  const removed: Array<{ method: 'get' | 'post' | 'patch'; path: string }> = [
    { method: 'get',   path: '/v1/admin/reconciliation/status' },
    { method: 'post',  path: '/v1/admin/reconciliation/run' },
    { method: 'get',   path: '/v1/admin/fraud/flags' },
    { method: 'patch', path: '/v1/admin/fraud/flags/flag_001' },
    { method: 'post',  path: '/v1/admin/fraud/scan' },
  ];

  for (const { method, path } of removed) {
    it(`${method.toUpperCase()} ${path} returns 404 (not 500 or silent success)`, async () => {
      const res = await request(app)[method](path)
        .set(ADMIN_HEADERS)
        .set('Content-Type', 'application/json');

      expect(res.status).toBe(404);
    });
  }

  it('removed endpoint GET /v1/admin/reconciliation/status is not silently succeeding', async () => {
    const res = await request(app)
      .get('/v1/admin/reconciliation/status')
      .set(ADMIN_HEADERS);

    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(500);
  });

  it('removed endpoint POST /v1/admin/fraud/scan is not silently succeeding', async () => {
    const res = await request(app)
      .post('/v1/admin/fraud/scan')
      .set(ADMIN_HEADERS)
      .send({});

    expect(res.status).not.toBe(200);
    expect(res.status).not.toBe(201);
    expect(res.status).not.toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Suite 3 — Authentication gate on documented endpoints
//
// Confirms that all documented admin endpoints reject unauthenticated calls
// with 401 (not 404, which would indicate the route is missing).
// ---------------------------------------------------------------------------

describe('Admin API — unauthenticated requests are rejected on documented endpoints', () => {
  let app: ReturnType<typeof buildApp>;

  beforeAll(() => {
    app = buildApp();
  });

  const documented: Array<{ method: 'get' | 'patch' | 'delete' | 'post'; path: string; body?: object }> = [
    { method: 'get',    path: '/v1/admin/stats' },
    { method: 'get',    path: '/v1/admin/users' },
    { method: 'patch',  path: '/v1/admin/users/user_001', body: { updates: {}, adminId: 'admin_001' } },
    { method: 'delete', path: '/v1/admin/users/user_001', body: { adminId: 'admin_001' } },
    { method: 'get',    path: '/v1/admin/groups' },
    { method: 'post',   path: '/v1/admin/groups/group_001/flag', body: { flagged: true, adminId: 'admin_001' } },
    { method: 'get',    path: '/v1/admin/audit-logs' },
  ];

  for (const { method, path, body } of documented) {
    it(`${method.toUpperCase()} ${path} returns 401 without admin secret`, async () => {
      const req = request(app)[method](path)
        .set(NO_AUTH_HEADERS)
        .set('Content-Type', 'application/json');

      const res = body ? await req.send(body) : await req;

      expect(res.status).toBe(401);
    });
  }
});
