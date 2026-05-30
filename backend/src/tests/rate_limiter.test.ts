import { createRateLimiterMiddleware } from '../rate_limiter';

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

function makeReqRes(overrides: Record<string, any> = {}) {
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

function runMiddleware(middleware: ReturnType<typeof createRateLimiterMiddleware>, req: any, res: any): boolean {
    let nextCalled = false;
    middleware(req, res, () => { nextCalled = true; });
    return nextCalled;
}

async function runTests() {
    console.log('\n🧪 Rate Limiter Tests');

    // Sliding window strategy behavior
    {
        console.log('\n── sliding-window behavior');
        let nowMs = 0;
        const limiter = createRateLimiterMiddleware({
            ipPolicy: { windowMs: 1000, max: 2 },
            userPolicy: { windowMs: 1000, max: 3 },
            now: () => nowMs,
        });

        const first = makeReqRes({ ip: '10.0.0.1' });
        const firstNext = runMiddleware(limiter, first.req, first.res);
        assert(firstNext, 'first request is allowed');
        assert(first.res.headers['X-RateLimit-Limit'] === '2', 'sets X-RateLimit-Limit header');
        assert(first.res.headers['X-RateLimit-Remaining'] === '1', 'sets X-RateLimit-Remaining after first hit');

        nowMs = 100;
        const second = makeReqRes({ ip: '10.0.0.1' });
        const secondNext = runMiddleware(limiter, second.req, second.res);
        assert(secondNext, 'second request in window is allowed');
        assert(second.res.headers['X-RateLimit-Remaining'] === '0', 'remaining becomes 0 at limit');

        nowMs = 200;
        const third = makeReqRes({ ip: '10.0.0.1' });
        const thirdNext = runMiddleware(limiter, third.req, third.res);
        assert(!thirdNext, 'third request in same window is blocked');
        assert(third.res.statusCode === 429, 'blocked request returns 429');
        assert(third.res.headers['Retry-After'] !== undefined, 'blocked request sets Retry-After header');

        nowMs = 1200;
        const fourth = makeReqRes({ ip: '10.0.0.1' });
        const fourthNext = runMiddleware(limiter, fourth.req, fourth.res);
        assert(fourthNext, 'request is allowed again after window slides');
    }

    // Per-IP for unauthenticated and per-user for authenticated users
    {
        console.log('\n── per-IP and per-user limits');
        let nowMs = 0;
        const limiter = createRateLimiterMiddleware({
            ipPolicy: { windowMs: 1000, max: 1 },
            userPolicy: { windowMs: 1000, max: 2 },
            now: () => nowMs,
        });

        const unauth1 = makeReqRes({ ip: '10.0.0.2' });
        assert(runMiddleware(limiter, unauth1.req, unauth1.res), 'unauthenticated IP first request allowed');

        nowMs = 10;
        const unauth2 = makeReqRes({ ip: '10.0.0.2' });
        assert(!runMiddleware(limiter, unauth2.req, unauth2.res), 'unauthenticated IP second request blocked by IP limit');

        nowMs = 20;
        const auth1 = makeReqRes({
            ip: '10.0.0.2',
            headers: { authorization: 'Bearer token', 'x-user-id': 'user-1' },
        });
        assert(runMiddleware(limiter, auth1.req, auth1.res), 'authenticated user first request allowed');
        assert(auth1.res.headers['X-RateLimit-Limit'] === '2', 'authenticated request uses user limit');

        nowMs = 30;
        const auth2 = makeReqRes({
            ip: '10.0.0.2',
            headers: { authorization: 'Bearer token', 'x-user-id': 'user-1' },
        });
        assert(runMiddleware(limiter, auth2.req, auth2.res), 'authenticated user second request allowed');

        nowMs = 40;
        const auth3 = makeReqRes({
            ip: '10.0.0.2',
            headers: { authorization: 'Bearer token', 'x-user-id': 'user-1' },
        });
        assert(!runMiddleware(limiter, auth3.req, auth3.res), 'authenticated user third request blocked by user limit');
    }

    // Authenticated bypass when request is authenticated but no user id is available
    {
        console.log('\n── authenticated bypass');
        let nowMs = 0;
        const limiter = createRateLimiterMiddleware({
            ipPolicy: { windowMs: 1000, max: 1 },
            userPolicy: { windowMs: 1000, max: 1 },
            now: () => nowMs,
        });

        const bypass1 = makeReqRes({ headers: { authorization: 'Bearer token' }, ip: '10.0.0.3' });
        const bypass2 = makeReqRes({ headers: { authorization: 'Bearer token' }, ip: '10.0.0.3' });

        assert(runMiddleware(limiter, bypass1.req, bypass1.res), 'authenticated request without user id bypasses rate limit (1)');
        nowMs = 10;
        assert(runMiddleware(limiter, bypass2.req, bypass2.res), 'authenticated request without user id bypasses rate limit (2)');
        assert(bypass2.res.statusCode === 200, 'bypassed request is not throttled');
    }

    console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
    console.log('ALL RATE LIMITER TESTS PASSED! 🎉\n');
}

runTests().catch(err => {
    console.error(err);
    process.exit(1);
});
