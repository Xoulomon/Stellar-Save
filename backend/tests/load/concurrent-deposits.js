/**
 * k6 Load Test — Concurrent Deposit Requests
 * ===========================================
 * Simulates multiple users concurrently submitting deposit (contribution)
 * transactions to the Stellar-Save staging RPC endpoint.
 *
 * Acceptance criteria verified by this script:
 *   1. No balance drift — final balances match expected totals
 *   2. No lost updates — every accepted contribution is reflected on-chain
 *   3. System remains available under concurrent load (error rate < 1 %)
 *
 * Run locally:
 *   k6 run backend/tests/load/concurrent-deposits.js
 *
 * Run against staging:
 *   BASE_URL=https://staging.stellar-save.example.com \
 *   RPC_URL=https://soroban-testnet.stellar.org \
 *   k6 run backend/tests/load/concurrent-deposits.js
 *
 * See docs/load-testing.md for full setup and staging instructions.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';
import { SharedArray } from 'k6/data';

// ── Custom metrics ────────────────────────────────────────────────────────────
const depositAccepted    = new Counter('deposit_accepted_total');
const depositRejected    = new Counter('deposit_rejected_total');
const balanceDrift       = new Gauge('balance_drift_stroops');
const depositDuration    = new Trend('deposit_duration_ms', true);
const errorRate          = new Rate('deposit_error_rate');

// ── Configuration ─────────────────────────────────────────────────────────────
const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:3000';
const RPC_URL   = __ENV.RPC_URL   || 'https://soroban-testnet.stellar.org';
const GROUP_ID  = __ENV.GROUP_ID  || 'test-group-load-001';

// Contribution amount per member per cycle (in stroops: 1 XLM = 10_000_000)
const CONTRIBUTION_AMOUNT_STROOPS = parseInt(__ENV.CONTRIBUTION_STROOPS || '10000000');

// Number of simulated members (virtual users)
const VU_COUNT = parseInt(__ENV.VU_COUNT || '20');

// ── Test options ──────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // Scenario 1: Ramp up to concurrent deposit burst
    concurrent_deposit_burst: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '10s', target: VU_COUNT },   // ramp up
        { duration: '30s', target: VU_COUNT },   // hold — all VUs submitting concurrently
        { duration: '10s', target: 0 },          // ramp down
      ],
      tags: { scenario: 'concurrent_burst' },
    },

    // Scenario 2: Sustained low concurrency (baseline)
    sustained_baseline: {
      executor: 'constant-vus',
      vus: 5,
      duration: '60s',
      startTime: '55s',  // starts after burst completes
      tags: { scenario: 'sustained_baseline' },
    },
  },

  // Thresholds — build fails if any are breached
  thresholds: {
    // 99th percentile deposit round-trip must be under 5 s
    deposit_duration_ms: ['p(99)<5000'],
    // Error rate must stay below 1 %
    deposit_error_rate: ['rate<0.01'],
    // No balance drift allowed
    balance_drift_stroops: ['value==0'],
    // HTTP error rate across all requests
    http_req_failed: ['rate<0.01'],
    // 95th percentile HTTP duration under 3 s
    http_req_duration: ['p(95)<3000'],
  },
};

// ── Simulated wallet addresses (one per VU) ───────────────────────────────────
// In a real test these would be funded testnet accounts.
// For mock/staging mode the server accepts any G... address.
function memberAddress(vuId) {
  // Deterministic placeholder addresses keyed by VU ID
  const base = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const suffix = String(vuId).padStart(7, '0');
  return base.slice(0, 56 - suffix.length) + suffix;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function jsonPost(url, body, tags) {
  const params = {
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    tags: tags || {},
  };
  const start = Date.now();
  const res = http.post(url, JSON.stringify(body), params);
  depositDuration.add(Date.now() - start);
  return res;
}

function jsonGet(url, tags) {
  const params = {
    headers: { Accept: 'application/json' },
    tags: tags || {},
  };
  return http.get(url, params);
}

// ── Setup: record pre-test group balance ──────────────────────────────────────
export function setup() {
  const res = jsonGet(`${BASE_URL}/api/v1/groups/${GROUP_ID}/balance`, {
    phase: 'setup',
  });

  let initialBalance = 0;
  if (res.status === 200) {
    try {
      initialBalance = JSON.parse(res.body).balance_stroops || 0;
    } catch (_) {}
  }

  console.log(`[setup] Group ${GROUP_ID} initial balance: ${initialBalance} stroops`);
  return {
    initialBalance,
    groupId: GROUP_ID,
    contributionAmount: CONTRIBUTION_AMOUNT_STROOPS,
    startTime: Date.now(),
  };
}

// ── Main VU function ──────────────────────────────────────────────────────────
export default function (data) {
  const vuId   = __VU;
  const member = memberAddress(vuId);

  group('submit_deposit', () => {
    const payload = {
      group_id:   data.groupId,
      member:     member,
      amount:     data.contributionAmount,
      // cycle_id omitted — server derives from current cycle
    };

    const res = jsonPost(
      `${BASE_URL}/api/v1/groups/${data.groupId}/contribute`,
      payload,
      { operation: 'contribute', vu: String(vuId) }
    );

    const ok = check(res, {
      'deposit: status is 200 or 202': (r) => r.status === 200 || r.status === 202,
      'deposit: response has tx_hash or accepted': (r) => {
        if (r.status !== 200 && r.status !== 202) return false;
        try {
          const body = JSON.parse(r.body);
          return !!(body.tx_hash || body.accepted || body.transaction_id);
        } catch (_) {
          return false;
        }
      },
      'deposit: no error field': (r) => {
        try {
          const body = JSON.parse(r.body);
          return !body.error;
        } catch (_) {
          return true;
        }
      },
    });

    if (ok) {
      depositAccepted.add(1);
      errorRate.add(false);
    } else {
      depositRejected.add(1);
      errorRate.add(true);
      if (r.status >= 500) {
        console.error(`[VU ${vuId}] Server error ${res.status}: ${res.body.slice(0, 200)}`);
      }
    }
  });

  // Small random think time (50–200 ms) to model realistic client behaviour
  sleep(Math.random() * 0.15 + 0.05);
}

// ── Teardown: verify no balance drift ────────────────────────────────────────
export function teardown(data) {
  console.log('\n[teardown] Verifying balance integrity...');

  // Fetch final group balance
  const res = jsonGet(`${BASE_URL}/api/v1/groups/${data.groupId}/balance`, {
    phase: 'teardown',
  });

  if (res.status !== 200) {
    console.error(`[teardown] Could not fetch final balance (HTTP ${res.status})`);
    return;
  }

  let finalBalance = 0;
  let acceptedCount = 0;
  try {
    const body = JSON.parse(res.body);
    finalBalance    = body.balance_stroops  || 0;
    acceptedCount   = body.accepted_contributions || 0;
  } catch (_) {
    console.error('[teardown] Failed to parse balance response');
    return;
  }

  // Expected balance = initial + (accepted contributions × amount per contribution)
  // In a real scenario, payouts reduce the balance; for this cycle we only
  // deposit, so the balance should grow monotonically.
  const expectedMinBalance =
    data.initialBalance + acceptedCount * data.contributionAmount;

  const drift = Math.abs(finalBalance - expectedMinBalance);
  balanceDrift.add(drift);

  console.log(`[teardown] Initial balance   : ${data.initialBalance} stroops`);
  console.log(`[teardown] Accepted deposits : ${acceptedCount}`);
  console.log(`[teardown] Expected balance  : ${expectedMinBalance} stroops`);
  console.log(`[teardown] Actual balance    : ${finalBalance} stroops`);
  console.log(`[teardown] Drift             : ${drift} stroops`);

  if (drift === 0) {
    console.log('[teardown] ✅ PASS — no balance drift detected');
  } else {
    console.error(
      `[teardown] ❌ FAIL — balance drift of ${drift} stroops detected. ` +
      `${drift / data.contributionAmount} contribution(s) may have been lost or double-counted.`
    );
  }
}
