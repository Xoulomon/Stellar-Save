/**
 * Versioning tests — run with: npx tsx src/tests/versioning.test.ts
 *
 * Tests the versioning middleware and both routers without starting a real HTTP server.
 */
import { versionMiddleware, SUPPORTED_VERSIONS, DEPRECATED_VERSIONS } from '../versioning';
import { migrateV1ToV2 as v2Migrate } from '../routes/v2';

// ── Minimal mock helpers ──────────────────────────────────────────────────────
function makeReqRes(path: string) {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers,
    status(code: number) { this.statusCode = code; return this; },
    json(body: unknown) { this.body = body; return this; },
    setHeader(k: string, v: string) { headers[k] = v; },
  };
  const req = { path, apiVersion: undefined as string | undefined };
  return { req, res };
}

function runMiddleware(path: string): { req: ReturnType<typeof makeReqRes>['req']; res: ReturnType<typeof makeReqRes>['res']; nextCalled: boolean } {
  const { req, res } = makeReqRes(path);
  let nextCalled = false;
  versionMiddleware(req as any, res as any, () => { nextCalled = true; });
  return { req, res, nextCalled };
}

// ── Test runner ───────────────────────────────────────────────────────────────
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

// ── Tests ─────────────────────────────────────────────────────────────────────
console.log('\n🧪 Versioning Middleware Tests');

{
  const { req, res, nextCalled } = runMiddleware('/api/v1/health');
  assert(nextCalled, 'v1 path calls next()');
  assert(res.headers['X-API-Version'] === 'v1', 'sets X-API-Version: v1');
  assert(req.apiVersion === 'v1', 'attaches apiVersion to req');
}

{
  const { res, nextCalled } = runMiddleware('/api/v2/health');
  assert(nextCalled, 'v2 path calls next()');
  assert(res.headers['X-API-Version'] === 'v2', 'sets X-API-Version: v2');
}

{
  const { res, nextCalled } = runMiddleware('/api/v99/health');
  assert(!nextCalled, 'unsupported version does not call next()');
  assert(res.statusCode === 400, 'unsupported version returns 400');
}

console.log('\n🧪 Deprecation Header Tests');

{
  const { res } = runMiddleware('/api/v1/health');
  const isV1Deprecated = 'v1' in DEPRECATED_VERSIONS;
  if (isV1Deprecated) {
    assert(res.headers['Deprecation'] === 'true', 'deprecated version sets Deprecation header');
    assert(!!res.headers['Sunset'], 'deprecated version sets Sunset header');
    assert(!!res.headers['X-API-Deprecation-Notice'], 'deprecated version sets X-API-Deprecation-Notice');
  } else {
    assert(res.headers['Deprecation'] === undefined, 'non-deprecated version has no Deprecation header');
  }
}

{
  const { res } = runMiddleware('/api/v2/health');
  assert(res.headers['Deprecation'] === undefined, 'v2 has no Deprecation header');
}

console.log('\n🧪 migrateV1ToV2 Helper Tests');

{
  const v1 = { status: 'ok', data: [1, 2, 3] };
  const v2 = v2Migrate(v1);
  assert(v2.apiVersion === 'v2', 'adds apiVersion: v2');
  assert(v2.status === 'ok', 'preserves original fields');
  assert(Array.isArray(v2.data), 'preserves array fields');
}

{
  const v1 = { userId: 'u1', recommendations: [] };
  const v2 = v2Migrate(v1);
  assert(v2.userId === 'u1', 'preserves userId');
  assert(v2.apiVersion === 'v2', 'adds apiVersion');
}

console.log('\n🧪 SUPPORTED_VERSIONS / DEPRECATED_VERSIONS Config Tests');

{
  assert(SUPPORTED_VERSIONS.includes('v1'), 'v1 is in SUPPORTED_VERSIONS');
  assert(SUPPORTED_VERSIONS.includes('v2'), 'v2 is in SUPPORTED_VERSIONS');
}

{
  const deprecated = Object.keys(DEPRECATED_VERSIONS);
  for (const v of deprecated) {
    const entry = DEPRECATED_VERSIONS[v as keyof typeof DEPRECATED_VERSIONS]!;
    assert(typeof entry.sunsetDate === 'string', `${v} deprecation has sunsetDate`);
    assert(typeof entry.message === 'string', `${v} deprecation has message`);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
else console.log('ALL VERSIONING TESTS PASSED! 🎉\n');
