'use strict';

/**
 * Synthetic monitoring checks for the savings-pool service.
 *
 * Each check returns a result object: { name, ok, latencyMs, error? }.
 * These results are consumed by the existing synthetic runner/alerting
 * pipeline (see scripts/synthetic/README.md for the thresholds they feed).
 */

const DEFAULT_TIMEOUT_MS = 15000;

function nowMs() {
  return Date.now();
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('synthetic check timed out')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Basic uptime check: the savings-pool API responds to a health probe.
 */
async function checkUptime({ baseUrl, fetchImpl = global.fetch, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const name = 'savings-pool:uptime';
  const startedAt = nowMs();
  try {
    const res = await withTimeout(fetchImpl(`${baseUrl}/health`), timeoutMs);
    if (!res.ok) {
      throw new Error(`health probe returned ${res.status}`);
    }
    return { name, ok: true, latencyMs: nowMs() - startedAt };
  } catch (error) {
    return { name, ok: false, latencyMs: nowMs() - startedAt, error: error.message };
  }
}

/**
 * Full contribution-flow check.
 *
 * Exercises a complete savings-pool contribution transaction against
 * testnet/staging: create a contribution, submit it, and confirm the
 * resulting balance reflects the contribution. This goes beyond the
 * uptime probe by validating the core money-movement path end to end.
 */
async function checkContributionFlow({
  baseUrl,
  accountId,
  amount,
  fetchImpl = global.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const name = 'savings-pool:contribution-flow';
  const startedAt = nowMs();
  try {
    const before = await withTimeout(
      fetchImpl(`${baseUrl}/accounts/${accountId}/balance`),
      timeoutMs,
    );
    if (!before.ok) {
      throw new Error(`balance read returned ${before.status}`);
    }
    const beforeBody = await before.json();

    const contribution = await withTimeout(
      fetchImpl(`${baseUrl}/savings-pool/contributions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ accountId, amount }),
      }),
      timeoutMs,
    );
    if (!contribution.ok) {
      throw new Error(`contribution submit returned ${contribution.status}`);
    }
    const contributionBody = await contribution.json();
    if (!contributionBody || !contributionBody.id) {
      throw new Error('contribution response missing id');
    }

    const after = await withTimeout(
      fetchImpl(`${baseUrl}/accounts/${accountId}/balance`),
      timeoutMs,
    );
    if (!after.ok) {
      throw new Error(`balance re-read returned ${after.status}`);
    }
    const afterBody = await after.json();

    const delta = Number(afterBody.balance) - Number(beforeBody.balance);
    if (delta !== Number(amount)) {
      throw new Error(`balance delta ${delta} did not match contribution ${amount}`);
    }

    return { name, ok: true, latencyMs: nowMs() - startedAt };
  } catch (error) {
    return { name, ok: false, latencyMs: nowMs() - startedAt, error: error.message };
  }
}

/**
 * Run all synthetic checks and return their results.
 */
async function runChecks(options) {
  const results = [];
  results.push(await checkUptime(options));
  results.push(await checkContributionFlow(options));
  return results;
}

module.exports = {
  checkUptime,
  checkContributionFlow,
  runChecks,
};
