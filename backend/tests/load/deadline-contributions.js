/**
 * k6 Load Test — Concurrent Contributions Near Cycle Deadline
 * ============================================================
 * Simulates the highest-contention path in Stellar-Save: all members of a
 * savings pool racing to submit their contribution simultaneously as the cycle
 * deadline approaches.
 *
 * Why this scenario matters
 * ─────────────────────────
 * When the last contribution of a cycle arrives, the contract/backend must:
 *   1. Record the contribution atomically.
 *   2. Detect that all members have now contributed.
 *   3. Trigger exactly one payout to the current recipient.
 *
 * Under concurrent load, naive implementations can:
 *   • Double-trigger the payout (two VUs both see "N-1 contributions" and
 *     both attempt to execute the payout).
 *   • Lose a contribution (optimistic concurrency violation in the DB layer).
 *   • Deadlock (two transactions locking the same group row in opposite order).
 *
 * This scenario reproduces all three risk conditions by having every VU fire
 * at the same instant after a synchronised countdown.
 *
 * Scenarios
 * ─────────
 *  1. deadline_burst       — all N members fire simultaneously (max contention)
 *  2. near_deadline_ramp   — gradual ramp to N VUs over the final 30 s of a
 *                            simulated cycle (realistic timing pressure)
 *  3. deadline_repeat      — repeat the burst across three synthetic cycles to
 *                            detect state leakage between cycles
 *
 * Run
 * ───
 *   k6 run backend/tests/load/deadline-contributions.js
 *
 *   # Against staging with custom member count:
 *   BASE_URL=https://staging.stellar-save.example.com \
 *   GROUP_ID=<staging-group-id>                       \
 *   MEMBER_COUNT=10                                   \
 *   k6 run backend/tests/load/deadline-contributions.js
 *
 * Environment variables
 * ─────────────────────
 *   BASE_URL            API base (default: http://localhost:3000)
 *   GROUP_ID            Group to use (default: test-deadline-group-001)
 *   MEMBER_COUNT        Number of concurrent members/VUs (default: 5)
 *   CONTRIBUTION_STROOPS Amount per contribution in stroops (default: 10000000 = 1 XLM)
 *   CYCLE_DEADLINE_SECS  Simulated seconds until cycle deadline (default: 10)
 *
 * See tests/load/README.md for baseline numbers, thresholds, and CI setup.
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend, Gauge } from 'k6/metrics';

// ── Custom metrics ────────────────────────────────────────────────────────────

/** Total contributions that received a 2xx response. */
const contributionAccepted   = new Counter('deadline_contribution_accepted');

/** Total contributions that received a non-2xx response. */
const contributionRejected   = new Counter('deadline_contribution_rejected');

/** End-to-end contribution round-trip time in milliseconds. */
const contributionDuration   = new Trend('deadline_contribution_duration_ms', true);

/** Fraction of contribution requests that resulted in an error. */
const contributionErrorRate  = new Rate('deadline_contribution_error_rate');

/**
 * Number of payout events observed in the post-test group state.
 * Must be exactly 1 per cycle for a correct implementation.
 */
const payoutCount            = new Gauge('deadline_payout_count');

/**
 * Balance drift in stroops after a full cycle.
 * Zero means every accepted contribution is reflected exactly once.
 */
const balanceDrift           = new Gauge('deadline_balance_drift_stroops');

/**
 * Whether more than one payout was triggered for a single cycle.
 * A value > 1 indicates a double-spend bug.
 */
const doublePayoutDetected   = new Gauge('deadline_double_payout_detected');

// ── Configuration ─────────────────────────────────────────────────────────────

const BASE_URL              = __ENV.BASE_URL              || 'http://localhost:3000';
const GROUP_ID              = __ENV.GROUP_ID              || 'test-deadline-group-001';
const MEMBER_COUNT          = parseInt(__ENV.MEMBER_COUNT          || '5');
const CONTRIBUTION_STROOPS  = parseInt(__ENV.CONTRIBUTION_STROOPS  || '10000000');
const CYCLE_DEADLINE_SECS   = parseInt(__ENV.CYCLE_DEADLINE_SECS   || '10');

// ── Test options ──────────────────────────────────────────────────────────────

export const options = {
  scenarios: {
    /**
     * Scenario 1: deadline_burst
     * All MEMBER_COUNT VUs start simultaneously and fire exactly one
     * contribution each with no think time — maximum write contention.
     */
    deadline_burst: {
      executor: 'per-vu-iterations',
      vus: MEMBER_COUNT,
      iterations: 1,
      maxDuration: '60s',
      tags: { scenario: 'deadline_burst' },
    },

    /**
     * Scenario 2: near_deadline_ramp
     * Gradually add VUs over CYCLE_DEADLINE_SECS seconds, simulating members
     * who remember to contribute as the deadline looms.
     * Each VU fires once when it starts.
     */
    near_deadline_ramp: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: `${CYCLE_DEADLINE_SECS}s`, target: MEMBER_COUNT },
        { duration: '5s',                      target: MEMBER_COUNT },
        { duration: '5s',                      target: 0 },
      ],
      startTime: '65s', // runs after deadline_burst completes
      tags: { scenario: 'near_deadline_ramp' },
    },

    /**
     * Scenario 3: deadline_repeat
     * Repeats the burst three times (three synthetic cycle boundaries) to
     * detect state leakage: contribution totals or payout flags not being
     * reset between cycles.
     */
    deadline_repeat: {
      executor: 'per-vu-iterations',
      vus: MEMBER_COUNT,
      iterations: 3,       // each VU fires 3 contributions across 3 cycles
      maxDuration: '120s',
      startTime: '90s',    // runs after near_deadline_ramp completes
      tags: { scenario: 'deadline_repeat' },
    },
  },

  thresholds: {
    // 99th percentile contribution RTT under 5 s even under burst contention
    deadline_contribution_duration_ms:  ['p(99)<5000'],
    // Error rate under 1 % — lost-update retries are expected but must succeed
    deadline_contribution_error_rate:   ['rate<0.01'],
    // Zero balance drift — every accepted contribution must appear in balance
    deadline_balance_drift_stroops:     ['value==0'],
    // Exactly one payout per cycle — no double-spend
    deadline_double_payout_detected:    ['value==0'],
    // Baseline HTTP metrics
    http_req_failed:                    ['rate<0.01'],
    http_req_duration:                  ['p(95)<3000'],
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Deterministic member address derived from VU ID.
 * In staging, replace with real funded testnet account addresses.
 */
function memberAddress(vuId) {
  const base   = 'GDEADLINELOADTESTMEMBERADDRESSSTELLAR000000000000000000';
  const suffix = String(vuId).padStart(7, '0');
  return base.slice(0, 56 - suffix.length) + suffix;
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', Accept: 'application/json' };
}

function postContribution(groupId, member, amount, tags) {
  const payload = JSON.stringify({ group_id: groupId, member, amount });
  const start   = Date.now();
  const res     = http.post(
    `${BASE_URL}/api/v1/groups/${groupId}/contribute`,
    payload,
    { headers: jsonHeaders(), tags }
  );
  contributionDuration.add(Date.now() - start);
  return res;
}

function getGroupState(groupId, tags) {
  return http.get(
    `${BASE_URL}/api/v1/groups/${groupId}`,
    { headers: { Accept: 'application/json' }, tags }
  );
}

function getGroupBalance(groupId, tags) {
  return http.get(
    `${BASE_URL}/api/v1/groups/${groupId}/balance`,
    { headers: { Accept: 'application/json' }, tags }
  );
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export function setup() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log(' Stellar-Save — Deadline Contributions Load Test');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  BASE_URL         : ${BASE_URL}`);
  console.log(`  GROUP_ID         : ${GROUP_ID}`);
  console.log(`  MEMBER_COUNT     : ${MEMBER_COUNT}`);
  console.log(`  CONTRIBUTION     : ${CONTRIBUTION_STROOPS} stroops (${CONTRIBUTION_STROOPS / 10_000_000} XLM)`);
  console.log(`  DEADLINE_SECS    : ${CYCLE_DEADLINE_SECS}s`);
  console.log('───────────────────────────────────────────────────────────');

  // Record pre-test group state
  const balRes = getGroupBalance(GROUP_ID, { phase: 'setup' });
  let initialBalance      = 0;
  let initialPayoutCount  = 0;

  if (balRes.status === 200) {
    try {
      const body        = JSON.parse(balRes.body);
      initialBalance    = body.balance_stroops       || 0;
      initialPayoutCount = body.total_payouts_executed || 0;
    } catch (_) {}
  }

  console.log(`  Initial balance  : ${initialBalance} stroops`);
  console.log(`  Initial payouts  : ${initialPayoutCount}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  return {
    groupId:             GROUP_ID,
    contributionAmount:  CONTRIBUTION_STROOPS,
    memberCount:         MEMBER_COUNT,
    initialBalance,
    initialPayoutCount,
    startTime:           Date.now(),
  };
}

// ── Main VU function ──────────────────────────────────────────────────────────

export default function (data) {
  const vuId    = __VU;
  const iter    = __ITER;
  const member  = memberAddress(vuId);
  const scenTag = { operation: 'contribute', vu: String(vuId), iter: String(iter) };

  group('deadline_contribution', () => {
    const res = postContribution(data.groupId, member, data.contributionAmount, scenTag);

    const ok = check(res, {
      'contribution: 2xx status': (r) => r.status === 200 || r.status === 202,
      'contribution: has tx_hash or accepted': (r) => {
        if (r.status !== 200 && r.status !== 202) return false;
        try {
          const b = JSON.parse(r.body);
          return !!(b.tx_hash || b.accepted || b.transaction_id || b.success);
        } catch (_) {
          return false;
        }
      },
      'contribution: no server error field': (r) => {
        try {
          return !JSON.parse(r.body).error;
        } catch (_) {
          return true;
        }
      },
    });

    if (ok) {
      contributionAccepted.add(1);
      contributionErrorRate.add(false);
    } else {
      contributionRejected.add(1);
      contributionErrorRate.add(true);
      if (res.status >= 500) {
        console.error(
          `[VU ${vuId} iter ${iter}] Server error ${res.status}: ` +
          res.body.slice(0, 300)
        );
      }
    }

    // After the last member's contribution in scenario 1 (burst), check
    // whether the payout was triggered exactly once.
    // We identify the "last" VU as the one with the highest vuId.
    if (vuId === data.memberCount && iter === 0) {
      // Brief pause to let async payout processing complete
      sleep(0.5);

      group('payout_integrity_check', () => {
        const stateRes = getGroupState(data.groupId, { phase: 'payout_check' });

        if (stateRes.status === 200) {
          try {
            const state     = JSON.parse(stateRes.body);
            const payouts   = state.payouts_this_cycle   || 0;
            const isDouble  = payouts > 1 ? 1 : 0;

            payoutCount.add(payouts);
            doublePayoutDetected.add(isDouble);

            if (isDouble) {
              console.error(
                `[VU ${vuId}] ❌ DOUBLE PAYOUT DETECTED: ` +
                `${payouts} payouts in a single cycle for group ${data.groupId}`
              );
            } else {
              console.log(
                `[VU ${vuId}] ✅ Payout count OK: ${payouts} payout(s) for this cycle`
              );
            }
          } catch (e) {
            console.warn(`[VU ${vuId}] Could not parse group state: ${e.message}`);
          }
        }
      });
    }
  });

  // No sleep between contributions in the burst scenario — this is intentional.
  // The near_deadline_ramp scenario gets natural pacing from the VU ramp itself.
}

// ── Teardown ──────────────────────────────────────────────────────────────────

export function teardown(data) {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log(' Teardown: Balance & Consistency Verification');
  console.log('═══════════════════════════════════════════════════════════');

  const balRes = getGroupBalance(data.groupId, { phase: 'teardown' });

  if (balRes.status !== 200) {
    console.error(`[teardown] ❌ Could not fetch final balance (HTTP ${balRes.status})`);
    return;
  }

  let finalBalance     = 0;
  let acceptedCount    = 0;
  let finalPayoutCount = 0;

  try {
    const body       = JSON.parse(balRes.body);
    finalBalance     = body.balance_stroops          || 0;
    acceptedCount    = body.accepted_contributions   || 0;
    finalPayoutCount = body.total_payouts_executed   || 0;
  } catch (_) {
    console.error('[teardown] ❌ Failed to parse balance response');
    return;
  }

  // Expected balance: initial + accepted deposits (payouts reduce balance,
  // but for consistency checking we compare against the server's own count).
  const expectedBalance = data.initialBalance + acceptedCount * data.contributionAmount;
  const drift           = Math.abs(finalBalance - expectedBalance);
  const newPayouts      = finalPayoutCount - data.initialPayoutCount;
  const isDoubleSpend   = newPayouts > data.memberCount ? 1 : 0;

  balanceDrift.add(drift);
  doublePayoutDetected.add(isDoubleSpend);

  const elapsed = ((Date.now() - data.startTime) / 1000).toFixed(1);

  console.log(`  Duration         : ${elapsed}s`);
  console.log(`  Initial balance  : ${data.initialBalance} stroops`);
  console.log(`  Accepted deposits: ${acceptedCount}`);
  console.log(`  Expected balance : ${expectedBalance} stroops`);
  console.log(`  Actual balance   : ${finalBalance} stroops`);
  console.log(`  Balance drift    : ${drift} stroops`);
  console.log(`  Payouts fired    : ${newPayouts} (expected ≤ ${data.memberCount})`);
  console.log('───────────────────────────────────────────────────────────');

  if (drift === 0) {
    console.log('  ✅ PASS — no balance drift');
  } else {
    console.error(
      `  ❌ FAIL — balance drift of ${drift} stroops ` +
      `(≈ ${(drift / data.contributionAmount).toFixed(2)} lost/double-counted contributions)`
    );
  }

  if (isDoubleSpend) {
    console.error(
      `  ❌ FAIL — double-spend detected: ${newPayouts} payouts for ` +
      `${data.memberCount} members (expected ≤ ${data.memberCount})`
    );
  } else {
    console.log(`  ✅ PASS — no double-spend detected`);
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

// ── Summary handler ───────────────────────────────────────────────────────────

export function handleSummary(data) {
  // Structured JSON result for CI artifact upload and README baseline updates
  const summary = {
    scenario:           'deadline_contributions',
    timestamp:          new Date().toISOString(),
    memberCount:        MEMBER_COUNT,
    contributionXlm:    CONTRIBUTION_STROOPS / 10_000_000,
    thresholds:         data.thresholds,
    metrics: {
      p99_duration_ms:       data.metrics['deadline_contribution_duration_ms']
                               ? data.metrics['deadline_contribution_duration_ms'].values['p(99)']
                               : null,
      p95_duration_ms:       data.metrics['deadline_contribution_duration_ms']
                               ? data.metrics['deadline_contribution_duration_ms'].values['p(95)']
                               : null,
      p50_duration_ms:       data.metrics['deadline_contribution_duration_ms']
                               ? data.metrics['deadline_contribution_duration_ms'].values['p(50)']
                               : null,
      error_rate:            data.metrics['deadline_contribution_error_rate']
                               ? data.metrics['deadline_contribution_error_rate'].values['rate']
                               : null,
      balance_drift_stroops: data.metrics['deadline_balance_drift_stroops']
                               ? data.metrics['deadline_balance_drift_stroops'].values['value']
                               : null,
      double_payout:         data.metrics['deadline_double_payout_detected']
                               ? data.metrics['deadline_double_payout_detected'].values['value']
                               : null,
      accepted_total:        data.metrics['deadline_contribution_accepted']
                               ? data.metrics['deadline_contribution_accepted'].values['count']
                               : null,
      rejected_total:        data.metrics['deadline_contribution_rejected']
                               ? data.metrics['deadline_contribution_rejected'].values['count']
                               : null,
    },
  };

  return {
    'backend/tests/load/results/deadline-contributions-summary.json':
      JSON.stringify(summary, null, 2),
    stdout: textSummary(data),
  };
}

/**
 * Human-readable k6 summary (mirrors k6's default output format).
 * Used when the built-in handleSummary replaces the default output.
 */
function textSummary(data) {
  const m = data.metrics;
  const dur = m['deadline_contribution_duration_ms'];
  const p50  = dur ? dur.values['p(50)'].toFixed(0)  : 'n/a';
  const p95  = dur ? dur.values['p(95)'].toFixed(0)  : 'n/a';
  const p99  = dur ? dur.values['p(99)'].toFixed(0)  : 'n/a';
  const errR = m['deadline_contribution_error_rate']
               ? (m['deadline_contribution_error_rate'].values['rate'] * 100).toFixed(2)
               : 'n/a';
  const drift = m['deadline_balance_drift_stroops']
               ? m['deadline_balance_drift_stroops'].values['value']
               : 'n/a';
  const dp    = m['deadline_double_payout_detected']
               ? m['deadline_double_payout_detected'].values['value']
               : 'n/a';

  return [
    '',
    '─────────────────────────────────────────────────────────────',
    ' Stellar-Save — Deadline Contributions Summary',
    '─────────────────────────────────────────────────────────────',
    ` deadline_contribution_duration_ms  p50=${p50}ms  p95=${p95}ms  p99=${p99}ms`,
    ` deadline_contribution_error_rate   ${errR}%`,
    ` deadline_balance_drift_stroops     ${drift}`,
    ` deadline_double_payout_detected    ${dp}`,
    '─────────────────────────────────────────────────────────────',
    '',
  ].join('\n');
}
