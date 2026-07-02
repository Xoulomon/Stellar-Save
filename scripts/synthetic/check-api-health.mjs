#!/usr/bin/env node
// Synthetic check for the read-only API health journey.
// Usage: API_BASE_URL=https://api.example.com node scripts/synthetic/check-api-health.mjs

const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3001/api/v2';
const timeoutMs = Number(process.env.SYNTHETIC_TIMEOUT_MS ?? 10_000);

const endpoints = ['/health', '/ready'];

async function checkEndpoint(path) {
  const url = `${baseUrl}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const res = await fetch(url, { signal: controller.signal });
    const durationMs = Date.now() - startedAt;
    if (!res.ok) {
      return { journey: `api-health${path}`, ok: false, durationMs, error: `HTTP ${res.status}` };
    }
    return { journey: `api-health${path}`, ok: true, durationMs };
  } catch (err) {
    return {
      journey: `api-health${path}`,
      ok: false,
      durationMs: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

const results = await Promise.all(endpoints.map(checkEndpoint));
for (const result of results) {
  const status = result.ok ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${result.journey} (${result.durationMs}ms)${result.error ? ` — ${result.error}` : ''}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(`${failed.length}/${results.length} API health checks failed`);
  process.exit(1);
}
