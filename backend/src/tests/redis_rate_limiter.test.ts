import {
  createTieredRateLimiter,
  configureTier,
  setEndpointCost,
  getQuotaUsage,
  getTierConfig,
  getConfiguredTiers,
} from '../redis_rate_limiter';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

class MockRedis {
  private store = new Map<string, { score: number; member: string }[]>();

  async evalsha(_sha: string, _keyCount: number, ...args: string[]): Promise<any[]> {
    const key = args[0];
    const now = parseInt(args[1]);
    const windowMs = parseInt(args[2]);
    const max = parseInt(args[3]);
    const cost = parseInt(args[4]);

    const entries = this.store.get(key) || [];
    const cutoff = now - windowMs;
    const valid = entries.filter(e => e.score > cutoff);
    const count = valid.length;

    if (count + cost <= max) {
      for (let i = 0; i < cost; i++) {
        valid.push({ score: now, member: `${now}:mock:${i}` });
      }
      this.store.set(key, valid);
      return [1, max - count - cost, now + windowMs];
    }

    const oldestScore = valid.length > 0 ? valid[0].score : now;
    return [0, Math.max(0, max - count), oldestScore + windowMs];
  }

  async eval(_script: string, _keyCount: number, ..._args: string[]): Promise<any[]> {
    return this.evalsha('', _keyCount, ..._args);
  }

  async zremrangebyscore(_key: string, _min: number, _max: number): Promise<number> {
    return 0;
  }

  async zcard(_key: string): Promise<number> {
    return 0;
  }
}

function makeReqRes(overrides: Record<string, any> = {}) {
  const headers: Record<string, string> = {};
  const req = {
    method: 'GET',
    path: '/api/v1/health',
    ip: '127.0.0.1',
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  };

  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    setHeader(k: string, v: string) { this.headers[k] = String(v); },
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };

  return { req, res };
}

async function runMiddleware(
  middleware: ReturnType<typeof createTieredRateLimiter>,
  req: any,
  res: any,
): Promise<boolean> {
  let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return nextCalled;
}

async function runTests() {
  console.log('\n🧪 Tiered Redis Rate Limiter Tests');

  configureTier('free', [
    { windowMs: 1000, max: 2, label: '1m' },
    { windowMs: 5000, max: 5, label: '1h' },
  ]);
  configureTier('pro', [
    { windowMs: 1000, max: 5, label: '1m' },
    { windowMs: 5000, max: 20, label: '1h' },
  ]);
  configureTier('admin', []);
  setEndpointCost('/api/v1/health', 1, 'read');
  setEndpointCost('/api/v1/search', 5, 'read');

  // Tier configuration
  {
    console.log('\n── tier configuration');
    const tiers = getConfiguredTiers();
    assert(tiers.includes('free'), 'free tier is configured');
    assert(tiers.includes('pro'), 'pro tier is configured');
    assert(tiers.includes('admin'), 'admin tier is configured');

    const freeConfig = getTierConfig('free');
    assert(freeConfig !== undefined, 'free tier config is accessible');
    assert(freeConfig!.windows.length === 2, 'free tier has 2 windows');
    assert(freeConfig!.windows[0].max === 2, 'free tier 1m limit is 2');
  }

  // Admin bypass
  {
    console.log('\n── admin bypass');
    const mockRedis = new MockRedis() as any;
    const limiter = createTieredRateLimiter({ redis: mockRedis });

    const reqRes = makeReqRes({ adminId: 'admin_001' });
    const nextCalled = await runMiddleware(limiter, reqRes.req, reqRes.res);
    assert(nextCalled, 'admin request bypasses rate limiter');
    assert(reqRes.res.statusCode === 200, 'admin response is not 429');
  }

  // Free tier rate limiting
  {
    console.log('\n── free tier rate limiting');
    const mockRedis = new MockRedis() as any;
    const limiter = createTieredRateLimiter({ redis: mockRedis });

    // First request (free tier)
    const first = makeReqRes({ ip: '10.0.0.1' });
    const firstNext = await runMiddleware(limiter, first.req, first.res);
    assert(firstNext, 'free tier first request is allowed');
    assert(first.res.headers['X-RateLimit-Tier'] === 'free', 'tier header is free');
    assert(first.res.headers['X-RateLimit-Limit'] !== undefined, 'X-RateLimit-Limit header set');
    assert(first.res.headers['X-RateLimit-Remaining'] !== undefined, 'X-RateLimit-Remaining header set');
    assert(first.res.headers['X-RateLimit-Reset'] !== undefined, 'X-RateLimit-Reset header set');

    // Second request (should still be within limit)
    const second = makeReqRes({ ip: '10.0.0.1' });
    const secondNext = await runMiddleware(limiter, second.req, second.res);
    assert(secondNext, 'free tier second request is allowed');

    // Third request (should exceed 1m limit of 2)
    const third = makeReqRes({ ip: '10.0.0.1' });
    const thirdNext = await runMiddleware(limiter, third.req, third.res);
    assert(!thirdNext, 'free tier third request is blocked');
    assert(third.res.statusCode === 429, 'blocked request returns 429');
    assert(third.res.headers['Retry-After'] !== undefined, 'blocked request sets Retry-After');
  }

  // Pro tier has higher limits
  {
    console.log('\n── pro tier has higher limits');
    const mockRedis = new MockRedis() as any;
    const limiter = createTieredRateLimiter({ redis: mockRedis });

    for (let i = 0; i < 4; i++) {
      const r = makeReqRes({
        ip: '10.0.0.2',
        headers: { authorization: 'Bearer token' },
      });
      const nextCalled = await runMiddleware(limiter, r.req, r.res);
      assert(nextCalled, `pro tier request ${i + 1} is allowed`);
      assert(r.res.headers['X-RateLimit-Tier'] === 'pro', `tier header is pro on request ${i + 1}`);
    }
  }

  // Endpoint cost affects remaining
  {
    console.log('\n── endpoint cost affects quota');
    const mockRedis = new MockRedis() as any;
    const limiter = createTieredRateLimiter({ redis: mockRedis });

    // First request to cheap endpoint (cost=1)
    const cheap = makeReqRes({ ip: '10.0.0.3', path: '/api/v1/health' });
    await runMiddleware(limiter, cheap.req, cheap.res);
    assert(cheap.res.headers['X-RateLimit-Cost'] === '1', 'health endpoint cost is 1');

    // Request to expensive endpoint (cost=5)
    const expensive = makeReqRes({ ip: '10.0.0.4', path: '/api/v1/search' });
    await runMiddleware(limiter, expensive.req, expensive.res);
    assert(expensive.res.headers['X-RateLimit-Cost'] === '5', 'search endpoint cost is 5');
  }

  // Graceful degradation warnings
  {
    console.log('\n── graceful degradation warnings');
    const mockRedis = new MockRedis() as any;
    // Override mock to simulate near-limit state
    const nearLimitRedis = {
      evalsha: async () => [1, 0, Date.now() + 60000], // remaining = 0 but allowed
      eval: async () => [1, 0, Date.now() + 60000],
    } as any;
    const limiter = createTieredRateLimiter({ redis: nearLimitRedis });

    const r = makeReqRes({ ip: '10.0.0.5' });
    const nextCalled = await runMiddleware(limiter, r.req, r.res);
    assert(nextCalled, 'request near limit is still allowed');
    assert(r.res.headers['X-RateLimit-Warning'] !== undefined, 'X-RateLimit-Warning header is set');
  }

  // Quota usage reporting
  {
    console.log('\n── getQuotaUsage returns correct shape');
    const usage = await getQuotaUsage('test-user', 'free');
    assert(Array.isArray(usage), 'usage is an array');
    if (usage.length > 0) {
      assert(typeof usage[0].window === 'string', 'usage entry has window');
      assert(typeof usage[0].limit === 'number', 'usage entry has limit');
      assert(typeof usage[0].used === 'number', 'usage entry has used');
      assert(typeof usage[0].remaining === 'number', 'usage entry has remaining');
      assert(typeof usage[0].resetAt === 'number', 'usage entry has resetAt');
    }
  }

  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  console.log('ALL REDIS RATE LIMITER TESTS PASSED! 🎉\n');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
