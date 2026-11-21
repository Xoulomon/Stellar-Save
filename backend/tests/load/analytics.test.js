/**
 * k6 load test — Analytics API endpoint
 *
 * Simulates concurrent users accessing analytics dashboards and metrics.
 *
 * Run:
 *   k6 run backend/tests/load/analytics.test.js
 */
import { check, sleep, group } from 'k6';
import http from 'k6/http';
import { Counter, Trend, Rate } from 'k6/metrics';

import { BASE_URL, loadOptions } from '../../tests/load/config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const statsGroupsDuration = new Trend('stats_groups_duration', true);
const analyticsUserDuration = new Trend('analytics_user_duration', true);
const errorRate = new Rate('analytics_errors');
const analyticsReadOps = new Counter('analytics_read_ops');

// ── Options ───────────────────────────────────────────────────────────────────
export const options = {
  ...loadOptions,
  thresholds: {
    ...loadOptions.thresholds,
    analytics_read_ops: ['rate>5'],
  },
};

function randomUserId() {
  return `user_${Math.floor(Math.random() * 1000)}`;
}

// ── Test scenarios ────────────────────────────────────────────────────────────
export default function () {
  const userId = randomUserId();

  group('platform-wide group stats', () => {
    const res = http.get(`${BASE_URL}/api/v1/stats/groups`);
    analyticsReadOps.add(1);
    statsGroupsDuration.add(res.timings.duration);
    const ok = check(res, {
      'stats/groups status 200': (r) => r.status === 200,
      'stats/groups has totalGroups': (r) => r.json('totalGroups') !== undefined,
      'stats/groups has activeGroups': (r) => r.json('activeGroups') !== undefined,
      'stats/groups has totalMembers': (r) => r.json('totalMembers') !== undefined,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('user analytics', () => {
    const res = http.get(`${BASE_URL}/api/v1/analytics/${userId}`);
    analyticsReadOps.add(1);
    analyticsUserDuration.add(res.timings.duration);
    const ok = check(res, {
      'analytics status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('group analytics', () => {
    const groupId = Math.floor(Math.random() * 1000);
    const res = http.get(`${BASE_URL}/api/v1/analytics/groups/${groupId}`);
    analyticsReadOps.add(1);
    const ok = check(res, {
      'group analytics status 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    errorRate.add(!ok);
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'backend/tests/load/results/analytics-summary.json': JSON.stringify(data, null, 2),
  };
}
