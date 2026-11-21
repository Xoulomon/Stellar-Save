/**
 * k6 load test — Backend API (contract-facing endpoints)
 *
 * Simulates concurrent users hitting the recommendation, search,
 * preferences, and export endpoints that back the Stellar-Save frontend.
 *
 * Run:
 *   k6 run tests/load/api.test.js
 *   k6 run --env SCENARIO=stress tests/load/api.test.js
 *   k6 run --env BASE_URL=https://staging.example.com tests/load/api.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { BASE_URL, loadOptions, smokeOptions, stressOptions } from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const recommendationDuration = new Trend('recommendation_duration', true);
const searchDuration = new Trend('search_duration', true);
const errorRate = new Rate('api_errors');
const apiRequestOps = new Counter('api_request_ops');

// ── Options ───────────────────────────────────────────────────────────────────
const SCENARIO = __ENV.SCENARIO || 'load';
const profileOptions = SCENARIO === 'smoke'
  ? smokeOptions
  : SCENARIO === 'stress'
    ? stressOptions
    : loadOptions;
export const options = {
  ...profileOptions,
  thresholds: {
    ...profileOptions.thresholds,
    ...(SCENARIO === 'smoke' ? {} : { api_request_ops: ['rate>25'] }),
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
const HEADERS = { 'Content-Type': 'application/json' };

function randomUserId() {
  return `user_${Math.floor(Math.random() * 1000)}`;
}

// ── Test scenarios ────────────────────────────────────────────────────────────
export default function () {
  const userId = randomUserId();

  group('health check', () => {
    const res = http.get(`${BASE_URL}/api/v1/health`);
    apiRequestOps.add(1);
    const ok = check(res, {
      'health status 200': (r) => r.status === 200,
      'health body ok': (r) => r.json('status') === 'ok',
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('recommendations', () => {
    const res = http.get(`${BASE_URL}/api/v1/recommendations/${userId}`);
    apiRequestOps.add(1);
    recommendationDuration.add(res.timings.duration);
    const ok = check(res, {
      'recommendations status 200': (r) => r.status === 200,
      'recommendations has userId': (r) => r.json('userId') === userId,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('search', () => {
    const queries = ['savings', 'group', 'stellar', 'rosca', 'contribution'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(`${BASE_URL}/api/v1/search?q=${q}`);
    apiRequestOps.add(1);
    searchDuration.add(res.timings.duration);
    const ok = check(res, {
      'search status 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('set preferences', () => {
    const payload = JSON.stringify({
      userId,
      preferredCycleLength: 30,
      maxContribution: 100,
      preferredGroupSize: 10,
    });
    const res = http.post(`${BASE_URL}/api/v1/preferences`, payload, { headers: HEADERS });
    apiRequestOps.add(1);
    const ok = check(res, {
      'preferences status 200': (r) => r.status === 200,
    });
    errorRate.add(!ok);
  });

  if (Math.random() < 0.1) {
    group('request export', () => {
      const payload = JSON.stringify({
        userId,
        email: `${userId}@example.com`,
        format: Math.random() > 0.5 ? 'CSV' : 'JSON',
      });
      const res = http.post(`${BASE_URL}/api/v1/export`, payload, { headers: HEADERS });
      apiRequestOps.add(1);
      const ok = check(res, {
        'export accepted or validated': (r) => r.status === 202 || r.status === 400,
      });
      errorRate.add(!ok);
    });
  }

  group('metrics', () => {
    const res = http.get(`${BASE_URL}/metrics`);
    apiRequestOps.add(1);
    const ok = check(res, { 'metrics status 200': (r) => r.status === 200 });
    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'tests/load/results/api-summary.json': JSON.stringify(data, null, 2),
  };
}
