/**
 * k6 load test — Contribution flow (highest-traffic, money-related endpoints)
 *
 * Contributions in Stellar-Save are executed on-chain via the Soroban smart
 * contract. The backend does NOT expose a dedicated REST POST endpoint for
 * on-chain transactions. Instead, the contribution user journey drives these
 * backend endpoints (ordered as a real client would call them):
 *
 *   1. GET  /api/v1/groups                         – browse / pick a group
 *   2. GET  /api/v1/groups/:id                     – read group state before contributing
 *   3. POST /api/v1/analytics/events               – record contribution_made event
 *   4. GET  /api/v1/events?eventType=ContributionMade – verify event was indexed
 *   5. GET  /api/v1/stats/groups                   – refresh landing page stats
 *
 * Thresholds
 * ──────────
 * These are deliberately tighter than the generic API thresholds because this
 * path is (a) money-related and (b) the highest-traffic path on the platform.
 *
 *   contribution_event_post_duration  p(95) < 400 ms   (write: record event)
 *   contribution_event_post_duration  p(99) < 800 ms
 *   group_read_duration               p(95) < 300 ms   (read: group state)
 *   group_read_duration               p(99) < 600 ms
 *   event_index_query_duration        p(95) < 500 ms   (read: verify indexing)
 *   stats_duration                    p(95) < 300 ms   (read: landing stats, cached)
 *   contribution_error_rate           < 1%             (load), < 3% (stress)
 *   http_req_failed                   < 1%             (all scenarios)
 *
 * Run:
 *   k6 run tests/load/contribution.test.js
 *   k6 run --env SCENARIO=smoke   tests/load/contribution.test.js
 *   k6 run --env SCENARIO=stress  tests/load/contribution.test.js
 *   k6 run --env SCENARIO=spike   tests/load/contribution.test.js
 *   k6 run --env BASE_URL=https://staging.stellar-save.app tests/load/contribution.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';
import {
  BASE_URL,
  smokeOptions,
  loadOptions,
  stressOptions,
  spikeOptions,
} from './config.js';

// ── Custom metrics ────────────────────────────────────────────────────────────

/** POST /api/v1/analytics/events — the write-path "contribution" call */
const contributionEventPostDuration = new Trend('contribution_event_post_duration', true);

/** GET /api/v1/groups and GET /api/v1/groups/:id */
const groupReadDuration = new Trend('group_read_duration', true);

/** GET /api/v1/events?eventType=ContributionMade */
const eventIndexQueryDuration = new Trend('event_index_query_duration', true);

/** GET /api/v1/stats/groups */
const statsDuration = new Trend('stats_duration', true);

/** Tracks any step in the contribution journey that returns a non-success status */
const contributionErrorRate = new Rate('contribution_error_rate');

/** Total successfully posted contribution events */
const contributionEventOps = new Counter('contribution_event_ops');

// ── Scenario selection ────────────────────────────────────────────────────────

const SCENARIO = __ENV.SCENARIO || 'load';

const scenarioOptions = {
  smoke: smokeOptions,
  load: loadOptions,
  stress: stressOptions,
  spike: spikeOptions,
};

const scenarioThresholds = {
  smoke: {
    http_req_failed: ['rate<0.01'],
    contribution_event_post_duration: ['p(95)<400'],
    group_read_duration: ['p(95)<300'],
    stats_duration: ['p(95)<300'],
    contribution_error_rate: ['rate<0.01'],
  },
  load: {
    // Tighter SLA: this is the money path
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    contribution_event_post_duration: ['p(95)<400', 'p(99)<800'],
    group_read_duration: ['p(95)<300', 'p(99)<600'],
    event_index_query_duration: ['p(95)<500'],
    stats_duration: ['p(95)<300'],
    contribution_error_rate: ['rate<0.01'],
    contribution_event_ops: ['count>50'], // throughput floor
  },
  stress: {
    http_req_failed: ['rate<0.05'],
    contribution_event_post_duration: ['p(95)<1500'],
    group_read_duration: ['p(95)<800'],
    event_index_query_duration: ['p(95)<2000'],
    contribution_error_rate: ['rate<0.03'],
  },
  spike: {
    http_req_failed: ['rate<0.10'],
    contribution_event_post_duration: ['p(95)<2000'],
    contribution_error_rate: ['rate<0.05'],
  },
};

export const options = {
  ...(scenarioOptions[SCENARIO] || scenarioOptions.load),
  thresholds: scenarioThresholds[SCENARIO] || scenarioThresholds.load,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const HEADERS = { 'Content-Type': 'application/json' };

/**
 * Realistic Stellar wallet address pool.
 * Using valid-format addresses (G + 55 uppercase base32 chars) lets validation
 * middleware pass without requiring real keys.
 */
const WALLET_ADDRESSES = [
  'GAHJJJKMOKYE4RVPZEWZTKH5FVI4PA3VL7GK2LFNUBSGBV54WZD4FWT',
  'GBVZXKL3MHXJE6QBDJ5EFED7Y4HLBWJ7WNMXQ7U5M2QVLHUVN7K7MU',
  'GCEZWKCA5VLDNRLN3RPRJMRZOX3Z6G5CHCGKB2IH2YGCZ6QLNHAKCA',
  'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2',
  'GDXF5NZNP3M7MGKXMRM4UFGJIKCZQRJQIBDBBHXPAZEVLSJZLICQANQ',
  'GBSJ7CTGSFN36GZFLRJSOU4ZVJZW6Q5T7ZMIQAHOBQWWZ3DQLXTKX7N',
  'GCMK4YVNPQPWQX2TKYQFMLXL74GY6SOP4ISVJL3YXDVL45J5WUABN4',
  'GDRX3FFMGKQ72GM5TOM7ADFASAQZXIHPIXWVJPBZ6V2UIQD5RNN42GN',
  'GAQRXMCPKMFMZNKHJPXKN7GM2LRHKOSQBZSMJKRN5HWKUQQPLZDPXBB',
  'GCXKG6RN4ONIEPCMNFGFHYZMTQJJSRWJM5LCWK5KCCFX4XWKP5LSJM',
];

function randomWallet() {
  return WALLET_ADDRESSES[Math.floor(Math.random() * WALLET_ADDRESSES.length)];
}

function randomAmount() {
  // Realistic contribution range: 10–1000 XLM (stored as whole units)
  return Math.floor(Math.random() * 990) + 10;
}

function randomGroupId() {
  return `group_${Math.floor(Math.random() * 50) + 1}`;
}

// ── Test scenario ─────────────────────────────────────────────────────────────

export default function () {
  const wallet = randomWallet();
  const groupId = randomGroupId();
  const contributionAmount = randomAmount();

  // ── Step 1: Browse groups list ────────────────────────────────────────────
  group('1_browse_groups', () => {
    const res = http.get(`${BASE_URL}/api/v1/groups`);
    groupReadDuration.add(res.timings.duration);

    const ok = check(res, {
      'groups list: status 200': (r) => r.status === 200,
      'groups list: returns array': (r) => Array.isArray(r.json()),
    });
    contributionErrorRate.add(!ok);
  });

  sleep(0.3);

  // ── Step 2: Read group detail (pre-contribution state) ────────────────────
  group('2_read_group_detail', () => {
    const res = http.get(`${BASE_URL}/api/v1/groups/${groupId}`);
    groupReadDuration.add(res.timings.duration);

    // A 404 is acceptable if the group doesn't exist in the test environment;
    // only server errors (5xx) count as failures.
    const ok = check(res, {
      'group detail: not a server error': (r) => r.status < 500,
      'group detail: has id or error': (r) =>
        r.status === 200 || r.status === 404,
    });
    contributionErrorRate.add(!ok);
  });

  sleep(0.3);

  // ── Step 3: Record the contribution_made analytics event ──────────────────
  // This is the write path — the closest the backend comes to a contribution API.
  group('3_record_contribution_event', () => {
    const payload = JSON.stringify({
      eventType: 'transaction',
      eventName: 'contribution_made',
      userId: wallet,
      groupId: groupId,
      sessionId: `sess_${Math.floor(Math.random() * 100000)}`,
      eventData: {
        walletAddress: wallet,
        amount: contributionAmount,
        currency: 'XLM',
        cycleNumber: Math.floor(Math.random() * 12) + 1,
        txHash: `tx_${Math.random().toString(36).slice(2, 18)}`,
      },
    });

    const res = http.post(
      `${BASE_URL}/api/v1/analytics/events`,
      payload,
      { headers: HEADERS }
    );
    contributionEventPostDuration.add(res.timings.duration);

    const ok = check(res, {
      'contribution event: status 201': (r) => r.status === 201,
      'contribution event: acknowledged': (r) =>
        r.json('message') === 'Event recorded successfully',
    });
    contributionErrorRate.add(!ok);
    if (ok) contributionEventOps.add(1);
  });

  sleep(0.5);

  // ── Step 4: Verify contribution event was indexed (25% of VUs) ──────────
  // Avoids hammering the event index on every iteration while still covering
  // the read-back path under realistic load.
  if (Math.random() < 0.25) {
    group('4_verify_event_indexed', () => {
      const res = http.get(
        `${BASE_URL}/api/v1/events?eventType=ContributionMade&limit=5`
      );
      eventIndexQueryDuration.add(res.timings.duration);

      const ok = check(res, {
        'event index query: status 200': (r) => r.status === 200,
        'event index query: has items array': (r) =>
          Array.isArray(r.json('items')) || Array.isArray(r.json()),
      });
      contributionErrorRate.add(!ok);
    });
    sleep(0.2);
  }

  // ── Step 5: Refresh landing stats (50% of VUs — simulates UI re-render) ──
  if (Math.random() < 0.5) {
    group('5_refresh_stats', () => {
      const res = http.get(`${BASE_URL}/api/v1/stats/groups`);
      statsDuration.add(res.timings.duration);

      const ok = check(res, {
        'stats: status 200': (r) => r.status === 200,
      });
      contributionErrorRate.add(!ok);
    });
    sleep(0.2);
  }

  sleep(0.5);
}

// ── Summary output ────────────────────────────────────────────────────────────

export function handleSummary(data) {
  return {
    'tests/load/results/contribution-summary.json': JSON.stringify(data, null, 2),
  };
}
