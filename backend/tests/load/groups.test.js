/**
 * k6 load test — Groups API endpoint
 *
 * Simulates concurrent users browsing, filtering, and searching groups.
 *
 * Run:
 *   k6 run backend/tests/load/groups.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';
import { BASE_URL, loadOptions } from '../../tests/load/config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────
const groupsListDuration = new Trend('groups_list_duration', true);
const groupDetailDuration = new Trend('group_detail_duration', true);
const errorRate = new Rate('groups_errors');

// ── Options ───────────────────────────────────────────────────────────────────
export const options = loadOptions;

const HEADERS = { 'Content-Type': 'application/json' };

// ── Test scenarios ────────────────────────────────────────────────────────────
export default function () {
  group('list groups', () => {
    const res = http.get(`${BASE_URL}/api/v1/groups`);
    groupsListDuration.add(res.timings.duration);
    const ok = check(res, {
      'groups status 200': (r) => r.status === 200,
      'groups response is array': (r) => Array.isArray(r.json()),
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('filter groups by currency', () => {
    const currencies = ['XLM', 'USDC', 'EURC'];
    const currency = currencies[Math.floor(Math.random() * currencies.length)];
    const res = http.get(`${BASE_URL}/api/v1/groups?currency=${currency}`);
    groupsListDuration.add(res.timings.duration);
    const ok = check(res, {
      'filtered groups status 200': (r) => r.status === 200,
      'filtered groups is array': (r) => Array.isArray(r.json()),
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('search groups', () => {
    const queries = ['savings', 'circle', 'pool', 'community'];
    const q = queries[Math.floor(Math.random() * queries.length)];
    const res = http.get(`${BASE_URL}/api/v1/groups?search=${q}`);
    groupsListDuration.add(res.timings.duration);
    const ok = check(res, {
      'search groups status 200': (r) => r.status === 200,
      'search results is array': (r) => Array.isArray(r.json()),
    });
    errorRate.add(!ok);
  });

  sleep(0.5);

  group('get group detail', () => {
    // First get a list to get a valid group ID
    const listRes = http.get(`${BASE_URL}/api/v1/groups`);
    if (listRes.status === 200) {
      const groups = listRes.json();
      if (groups.length > 0) {
        const groupId = groups[0].id;
        const res = http.get(`${BASE_URL}/api/v1/groups/${groupId}`);
        groupDetailDuration.add(res.timings.duration);
        const ok = check(res, {
          'group detail status 200': (r) => r.status === 200,
          'group detail has id': (r) => r.json('id') !== undefined,
          'group detail has members': (r) => r.json('members') !== undefined,
        });
        errorRate.add(!ok);
      }
    }
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'backend/tests/load/results/groups-summary.json': JSON.stringify(data, null, 2),
  };
}
