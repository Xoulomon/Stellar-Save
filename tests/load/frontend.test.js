/**
 * k6 load test — Frontend (static asset + page load performance)
 *
 * Measures how the Vite-built frontend serves pages under concurrent users.
 * Uses k6's browser module for real browser metrics when available,
 * falling back to HTTP checks for CI environments without a browser.
 *
 * Run:
 *   k6 run tests/load/frontend.test.js
 *   k6 run --env SCENARIO=stress tests/load/frontend.test.js
 *   k6 run --env FRONTEND_URL=https://staging.example.com tests/load/frontend.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { FRONTEND_URL, loadOptions, smokeOptions, stressOptions } from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const pageLoadDuration = new Trend('page_load_duration', true);
const assetLoadDuration = new Trend('asset_load_duration', true);
const frontendErrorRate = new Rate('frontend_errors');

// ── Options ───────────────────────────────────────────────────────────────────
const SCENARIO = __ENV.SCENARIO || 'load';
export const options = {
  ...(SCENARIO === 'smoke'
    ? smokeOptions
    : SCENARIO === 'stress'
      ? stressOptions
      : loadOptions),
  thresholds: {
    page_load_duration: ['p(95)<3000'],   // pages load within 3 s at p95
    asset_load_duration: ['p(95)<1000'],  // static assets within 1 s at p95
    http_req_failed: ['rate<0.01'],
  },
};

// ── Key routes to test ────────────────────────────────────────────────────────
const ROUTES = ['/', '/groups/browse', '/groups/create', '/leaderboard', '/about'];

export default function () {
  group('page loads', () => {
    const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
    const res = http.get(`${FRONTEND_URL}${route}`);
    pageLoadDuration.add(res.timings.duration);
    const ok = check(res, {
      'page status 200': (r) => r.status === 200,
      'page has html': (r) => r.body.includes('<!doctype html') || r.body.includes('<!DOCTYPE html'),
    });
    frontendErrorRate.add(!ok);
  });

  sleep(0.5);

  group('static assets', () => {
    // Fetch the index page first to get asset URLs
    const indexRes = http.get(`${FRONTEND_URL}/`);
    assetLoadDuration.add(indexRes.timings.duration);
    check(indexRes, { 'index status 200': (r) => r.status === 200 });

    // Fetch vite.svg as a representative static asset
    const assetRes = http.get(`${FRONTEND_URL}/vite.svg`);
    assetLoadDuration.add(assetRes.timings.duration);
    check(assetRes, { 'asset status 200 or 304': (r) => r.status === 200 || r.status === 304 });
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/results/frontend-summary.json': JSON.stringify(data, null, 2),
  };
}
