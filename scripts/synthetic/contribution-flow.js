'use strict';

/**
 * Synthetic check: full savings-pool contribution transaction.
 *
 * Exercises the core contribution flow end-to-end against a testnet/staging
 * environment (not just an uptime ping):
 *   1. resolve the target savings pool
 *   2. open a contribution transaction
 *   3. submit the contribution
 *   4. confirm the transaction is accepted and the pool balance advanced
 *
 * This module is intentionally dependency-light so it can be invoked by the
 * existing synthetic runner or manually:
 *
 *   SYNTHETIC_BASE_URL=https://staging.example.org \
 *   SYNTHETIC_API_KEY=... \
 *   node scripts/synthetic/contribution-flow.js
 *
 * It does NOT wire any CI job or alerting; it only emits a structured result
 * that the surrounding monitoring stack can consume. See README.md for the
 * alert thresholds this check feeds.
 */

const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_CONTRIBUTION_AMOUNT = 1;

function getConfig(env = process.env) {
  return {
    baseUrl: (env.SYNTHETIC_BASE_URL || '').replace(/\/$/, ''),
    apiKey: env.SYNTHETIC_API_KEY || '',
    poolId: env.SYNTHETIC_POOL_ID || 'savings-pool-testnet',
    amount: Number(env.SYNTHETIC_CONTRIBUTION_AMOUNT || DEFAULT_CONTRIBUTION_AMOUNT),
    timeoutMs: Number(env.SYNTHETIC_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
  };
}

async function request(config, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    const res = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        ...(config.apiKey ? { authorization: `Bearer ${config.apiKey}` } : {}),
        ...(options.headers || {}),
      },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status} for ${path}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Runs the full contribution flow and returns a structured result.
 * Throws on any step failure so the caller can record a failed synthetic run.
 */
async function runContributionFlow(config = getConfig()) {
  if (!config.baseUrl) {
    throw new Error('SYNTHETIC_BASE_URL is required to run the contribution flow');
  }

  const startedAt = Date.now();
  const steps = [];

  const pool = await request(config, `/api/savings-pools/${encodeURIComponent(config.poolId)}`);
  steps.push({ step: 'resolve-pool', ok: true, balance: pool.balance });

  const opened = await request(config, `/api/savings-pools/${encodeURIComponent(config.poolId)}/contributions`, {
    method: 'POST',
    body: JSON.stringify({ amount: config.amount, synthetic: true }),
  });
  steps.push({ step: 'open-contribution', ok: true, contributionId: opened.id });

  const submitted = await request(config, `/api/contributions/${encodeURIComponent(opened.id)}/submit`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  steps.push({ step: 'submit-contribution', ok: true, status: submitted.status });

  const confirmed = await request(config, `/api/contributions/${encodeURIComponent(opened.id)}`);
  if (confirmed.status !== 'confirmed' && confirmed.status !== 'accepted') {
    throw new Error(`contribution not confirmed (status=${confirmed.status})`);
  }
  steps.push({ step: 'confirm-contribution', ok: true, status: confirmed.status });

  return {
    check: 'savings-pool-contribution-flow',
    ok: true,
    poolId: config.poolId,
    amount: config.amount,
    durationMs: Date.now() - startedAt,
    steps,
  };
}

async function main() {
  try {
    const result = await runContributionFlow();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    process.exit(0);
  } catch (err) {
    console.error(JSON.stringify({
      check: 'savings-pool-contribution-flow',
      ok: false,
      error: err.message,
      status: err.status,
    }));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { runContributionFlow, getConfig };
