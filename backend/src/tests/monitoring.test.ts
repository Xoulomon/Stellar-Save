/**
 * Monitoring tests — run with: npx tsx src/tests/monitoring.test.ts
 */
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { metricsMiddleware, metricsHandler, registry } from '../metrics';
import { logger, requestLogger } from '../logger';

let passed = 0, failed = 0;
function assert(cond: boolean, label: string) {
  if (cond) { console.log(`  ✅ ${label}`); passed++; }
  else       { console.error(`  ❌ ${label}`); failed++; }
}

function makeReqRes(method = 'GET', path = '/test') {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    on(event: string, cb: () => void) { if (event === 'finish') cb(); return this; },
    setHeader(k: string, v: string) { this.headers[k] = v; },
    set(k: string, v: string) { this.headers[k] = v; return this; },
    end(b?: string) { return this; },
  };
  const req = { method, path, ip: '127.0.0.1', headers: { 'user-agent': 'test' }, route: { path } };
  return { req, res };
}

async function run() {
  // ── prom-client primitives ──────────────────────────────────────────────────
  console.log('\n🧪 Metrics Primitives Tests');
  {
    const reg = new Registry();
    collectDefaultMetrics({ register: reg });

    const counter = new Counter({ name: 'test_counter', help: 'test', registers: [reg] });
    counter.inc(); counter.inc(3);
    const val = (await reg.getSingleMetricAsString('test_counter')).match(/test_counter (\d+)/)?.[1];
    assert(val === '4', 'Counter increments correctly');

    const hist = new Histogram({ name: 'test_hist', help: 'test', buckets: [0.1, 1], registers: [reg] });
    hist.observe(0.05); hist.observe(0.5);
    assert((await reg.getSingleMetricAsString('test_hist')).includes('test_hist_count 2'), 'Histogram records observations');

    const gauge = new Gauge({ name: 'test_gauge', help: 'test', registers: [reg] });
    gauge.inc(); gauge.dec();
    assert((await reg.getSingleMetricAsString('test_gauge')).includes('test_gauge 0'), 'Gauge inc/dec works');

    assert((await reg.metrics()).includes('nodejs_'), 'Default Node.js metrics collected');
  }

  // ── metricsMiddleware ───────────────────────────────────────────────────────
  console.log('\n🧪 metricsMiddleware Tests');
  {
    registry.resetMetrics();
    const { req, res } = makeReqRes('GET', '/api/v1/health');
    let nextCalled = false;
    metricsMiddleware(req as any, res as any, () => { nextCalled = true; });

    assert(nextCalled, 'metricsMiddleware calls next()');
    const counterStr = await registry.getSingleMetricAsString('http_requests_total');
    assert(counterStr.includes('method="GET"'), 'records method label');
    assert(counterStr.includes('status_code="200"'), 'records status_code label');
    const histStr = await registry.getSingleMetricAsString('http_request_duration_seconds');
    assert(/http_request_duration_seconds_count\{[^}]+\} 1/.test(histStr), 'records duration observation');
  }

  // ── metricsHandler ──────────────────────────────────────────────────────────
  console.log('\n🧪 metricsHandler Tests');
  {
    let body = '';
    const res = {
      headers: {} as Record<string, string>,
      set(k: string, v: string) { this.headers[k] = v; return this; },
      end(b: string) { body = b; return this; },
    };
    await metricsHandler({} as any, res as any);
    assert(res.headers['Content-Type']?.includes('text/plain'), 'sets Prometheus content-type');
    assert(body.includes('nodejs_'), 'response body contains metrics');
  }

  // ── logger ──────────────────────────────────────────────────────────────────
  console.log('\n🧪 Logger Tests');
  {
    const lines: string[] = [];
    const origOut = process.stdout.write.bind(process.stdout);
    const origErr = process.stderr.write.bind(process.stderr);
    (process.stdout as any).write = (c: string) => { lines.push(c); return true; };
    (process.stderr as any).write = (c: string) => { lines.push(c); return true; };

    logger.info('test message', { foo: 'bar' });
    logger.error('err msg', { code: 42 });

    (process.stdout as any).write = origOut;
    (process.stderr as any).write = origErr;

    assert(lines.length >= 2, 'logger writes info and error');
    const info = JSON.parse(lines[0]);
    assert(info['@timestamp'] !== undefined, 'log entry has @timestamp');
    assert(info.level === 'info', 'info level correct');
    assert(info.message === 'test message', 'message correct');
    assert(info.service === 'stellar-save-backend', 'service field present');
    assert(info.foo === 'bar', 'extra fields included');

    const err = JSON.parse(lines[1]);
    assert(err.level === 'error', 'error level correct');
    assert(err.code === 42, 'error extra fields included');
  }

  // ── requestLogger middleware ────────────────────────────────────────────────
  console.log('\n🧪 requestLogger Tests');
  {
    const { req, res } = makeReqRes('POST', '/api/v1/export');
    let nextCalled = false;
    const lines: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as any).write = (c: string) => { lines.push(c); return true; };

    requestLogger(req as any, res as any, () => { nextCalled = true; });

    (process.stdout as any).write = orig;

    assert(nextCalled, 'requestLogger calls next()');
    assert(lines.length > 0, 'requestLogger emits a log line');
    const entry = JSON.parse(lines[0]);
    assert(entry.method === 'POST', 'logs HTTP method');
    assert(entry.path === '/api/v1/export', 'logs request path');
    assert(typeof entry.duration_ms === 'number', 'logs duration_ms');
    assert(entry.status_code === 200, 'logs status_code');
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  else console.log('ALL MONITORING TESTS PASSED! 🎉\n');
}

run().catch(err => { console.error(err); process.exit(1); });
