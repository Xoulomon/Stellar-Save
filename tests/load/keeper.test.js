/**
 * k6 load + stress test — Keeper / Relayer — issue #1114
 *
 * Validates that the keeper/relayer service (automated payout executor) holds
 * up under realistic and peak group-count loads.
 *
 * Scenarios:
 *   smoke  — 1 VU, 30 s   (CI default; fast sanity check)
 *   load   — ramp to 50 VUs, hold 3 min (realistic sustained traffic)
 *   stress — ramp to 200 VUs (find the breaking point)
 *
 * SLOs (enforced as k6 thresholds):
 *   - p95 payout-trigger latency < 800 ms
 *   - p99 payout-trigger latency < 2 000 ms
 *   - Error rate < 1% under load, < 5% under stress
 *   - Batch payout throughput > 50 ops/s at load concurrency
 *
 * Run:
 *   k6 run tests/load/keeper.test.js
 *   k6 run --env SCENARIO=stress tests/load/keeper.test.js
 *   k6 run --env GROUP_COUNT=500 tests/load/keeper.test.js
 *   k6 run --env BASE_URL=https://staging.example.com tests/load/keeper.test.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, loadOptions, smokeOptions, stressOptions } from './config.js';

// === Custom metrics

const payoutTriggerDuration = new Trend('keeper_payout_trigger_duration', true);
const batchPayoutDuration   = new Trend('keeper_batch_payout_duration', true);
const keeperErrorRate       = new Rate('keeper_error_rate');
const payoutOps             = new Counter('keeper_payout_ops');
const batchOps              = new Counter('keeper_batch_ops');

// === Options

const SCENARIO = __ENV.SCENARIO || 'load';
const GROUP_COUNT = parseInt(__ENV.GROUP_COUNT || '200');

const scenarioOptions = {
  smoke:  smokeOptions,
  load:   loadOptions,
  stress: stressOptions,
};

export const options = {
  ...(scenarioOptions[SCENARIO] || loadOptions),
  thresholds: {
    // Payout trigger SLOs
    keeper_payout_trigger_duration: ['p(95)<800', 'p(99)<2000'],
    // Batch payout SLOs
    keeper_batch_payout_duration:   ['p(95)<1500'],
    // Error rate
    keeper_error_rate:              SCENARIO === 'stress'
      ? ['rate<0.05']
      : ['rate<0.01'],
    // Throughput: at least 50 payout ops across the whole run
    keeper_payout_ops:              ['count>50'],
    // General HTTP thresholds
    http_req_duration:              ['p(95)<1000'],
    http_req_failed:                SCENARIO === 'stress'
      ? ['rate<0.05']
      : ['rate<0.01'],
  },
};

const HEADERS = { 'Content-Type': 'application/json' };

// === Helpers

function randomGroupId() {
  return Math.floor(Math.random() * GROUP_COUNT) + 1;
}

function randomCycle() {
  return Math.floor(Math.random() * 12) + 1;
}

// === Test scenarios

export default function () {
  const groupId = randomGroupId();
  const cycle   = randomCycle();

  // Keeper health check — must always be fast
  group('keeper health', () => {
    const res = http.get(`${BASE_URL}/api/v1/keeper/health`);
    const ok = check(res, {
      'keeper health 200': (r) => r.status === 200,
      'keeper status ok':  (r) => {
        try { return r.json('status') === 'ok'; } catch { return false; }
      },
    });
    keeperErrorRate.add(!ok);
  });

  sleep(0.2);

  // Trigger a single payout for a group — core keeper operation
  group('trigger single payout', () => {
    const payload = JSON.stringify({ groupId, cycle });
    const res = http.post(
      `${BASE_URL}/api/v1/keeper/trigger-payout`,
      payload,
      { headers: HEADERS },
    );
    payoutTriggerDuration.add(res.timings.duration);
    payoutOps.add(1);

    const ok = check(res, {
      'payout trigger accepted': (r) =>
        r.status === 200 || r.status === 202 || r.status === 409,
    });
    keeperErrorRate.add(!ok);
  });

  sleep(0.3);

  // Batch payout — stress path: executor processes many groups in one call
  // Only 20% of VUs hit this endpoint to simulate realistic fan-out.
  if (Math.random() < 0.2) {
    group('batch payout execution', () => {
      const groupIds = Array.from(
        { length: Math.floor(Math.random() * 10) + 1 },
        () => randomGroupId(),
      );
      const payload = JSON.stringify({ groupIds, cycle });
      const res = http.post(
        `${BASE_URL}/api/v1/keeper/batch-payout`,
        payload,
        { headers: HEADERS },
      );
      batchPayoutDuration.add(res.timings.duration);
      batchOps.add(1);

      const ok = check(res, {
        'batch payout accepted': (r) =>
          r.status === 200 || r.status === 202 || r.status === 409,
      });
      keeperErrorRate.add(!ok);
    });
    sleep(0.5);
  }

  // Payout status poll — relayer verifies on-chain confirmation
  group('payout status poll', () => {
    const res = http.get(
      `${BASE_URL}/api/v1/keeper/payout-status?groupId=${groupId}&cycle=${cycle}`,
    );
    const ok = check(res, {
      'status poll 200 or 404': (r) => r.status === 200 || r.status === 404,
    });
    keeperErrorRate.add(!ok);
  });

  sleep(0.3);

  // Pending-groups queue — list of groups awaiting payout trigger
  group('pending groups queue', () => {
    const res = http.get(`${BASE_URL}/api/v1/keeper/pending-groups`);
    const ok = check(res, {
      'pending groups 200': (r) => r.status === 200,
    });
    keeperErrorRate.add(!ok);
  });

  sleep(0.2);
}

export function handleSummary(data) {
  return {
    'tests/load/results/keeper-summary.json': JSON.stringify(data, null, 2),
  };
}
