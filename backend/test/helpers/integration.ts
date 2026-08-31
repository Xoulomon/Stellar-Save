/**
 * Integration test helper that combines app setup and database fixtures.
 * Provides a complete test environment with real database and Express app.
 *
 * Usage:
 *   import { createTestContext } from '../helpers/integration';
 *
 *   describe('My Integration Tests', () => {
 *     let ctx: Awaited<ReturnType<typeof createTestContext>>;
 *
 *     beforeAll(async () => {
 *       ctx = await createTestContext();
 *     });
 *
 *     afterAll(async () => {
 *       await ctx.cleanup();
 *     });
 *
 *     it('should test an endpoint', async () => {
 *       const res = await request(ctx.app).get('/api/...');
 *       expect(res.status).toBe(200);
 *     });
 *   });
 */

import request from 'supertest';
import { buildApp } from './app';
import { setupDb, teardownDb, cleanDatabase, getPrisma } from './db';

export interface TestContext {
  app: ReturnType<typeof buildApp>['app'];
  prisma: ReturnType<typeof getPrisma>;
  cleanup: () => Promise<void>;
}

/**
 * Create a complete test environment with app and database.
 */
export async function createTestContext(): Promise<TestContext> {
  await setupDb();
  const prisma = getPrisma();
  const { app } = buildApp();

  await cleanDatabase();

  return {
    app,
    prisma,
    cleanup: async () => {
      await cleanDatabase();
      await teardownDb();
    },
  };
}

/**
 * Helper to make authenticated requests in tests.
 */
export function authenticatedRequest(app: any, token: string) {
  return request(app).set('Authorization', `Bearer ${token}`);
}

/**
 * Helper to make rate-limited requests and check headers.
 */
export async function checkRateLimitHeaders(
  res: any
): Promise<{
  limit: number;
  remaining: number;
  reset: Date;
}> {
  const limit = parseInt(res.get('X-RateLimit-Limit') || '0', 10);
  const remaining = parseInt(res.get('X-RateLimit-Remaining') || '0', 10);
  const reset = new Date(parseInt(res.get('X-RateLimit-Reset') || '0', 10) * 1000);

  return { limit, remaining, reset };
}
