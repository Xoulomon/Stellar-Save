/**
 * k6 load test — Contract API simulation (many groups scenario)
 *
 * Simulates the backend under load from many concurrent ROSCA groups:
 * - Multiple users reading recommendations for different groups
 * - Concurrent preference updates (simulating contribution events)
 * - Export job creation (simulating payout cycle completions)
 * - Metrics endpoint polling (simulating monitoring dashboards)
 *
 * Run:
 *   k6 run tests/load/contract.test.js
 *   k6 run --env GROUP_COUNT=500 tests/load/contract.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Trend } from 'k6/metrics';
import { BASE_URL, loadOptions } from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const groupReadOps = new Counter('group_read_ops');
const contributionOps = new Counter('contribution_ops');
const exportOps = new Counter('export_ops');
const metricsReadDuration = new Trend('metrics_read_duration', true);

// ── Options ───────────────────────────────────────────────────────────────────
const GROUP_COUNT = parseInt(__ENV.GROUP_COUNT || '200');

export const options = {
  ...loadOptions,
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    group_read_ops: ['count>100'],
  },
};

const HEADERS = { 'Content-Type': 'application/json' };

// ── Test scenarios ────────────────────────────────────────────────────────────
export default function () {
  const groupId = Math.floor(Math.random() * GROUP_COUNT);
  const userId = `member_${groupId}_${Math.floor(Math.random() * 10)}`;

  group('read group recommendations (many groups)', () => {
    const res = http.get(`${BASE_URL}/api/v1/recommendations/${userId}`);
    check(res, {
      'recommendations 200': (r) => r.status === 200,
      'has recommendations array': (r) => Array.isArray(r.json('recommendations')),
    });
    groupReadOps.add(1);
  });

  sleep(0.3);

  group('contribution event (preference update)', () => {
    const payload = JSON.stringify({
      userId,
      groupId: `group_${groupId}`,
      contributionAmount: Math.floor(Math.random() * 500) + 50,
      cycleNumber: Math.floor(Math.random() * 12) + 1,
    });
    const res = http.post(`${BASE_URL}/api/v1/preferences`, payload, { headers: HEADERS });
    check(res, { 'contribution accepted': (r) => r.status === 200 || r.status === 400 });
    contributionOps.add(1);
  });

  sleep(0.3);

  // Only 10% of VUs trigger an export (payout cycle completion)
  if (Math.random() < 0.1) {
    group('payout export (cycle completion)', () => {
      const payload = JSON.stringify({
        userId,
        email: `${userId}@example.com`,
        format: Math.random() > 0.5 ? 'CSV' : 'JSON',
      });
      const res = http.post(`${BASE_URL}/api/v1/export`, payload, { headers: HEADERS });
      check(res, { 'export accepted': (r) => r.status === 202 || r.status === 400 });
      exportOps.add(1);
    });
    sleep(0.2);
  }

  group('metrics polling', () => {
    const res = http.get(`${BASE_URL}/metrics`);
    metricsReadDuration.add(res.timings.duration);
    check(res, { 'metrics 200': (r) => r.status === 200 });
  });

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'tests/load/results/contract-summary.json': JSON.stringify(data, null, 2),
  };
}
