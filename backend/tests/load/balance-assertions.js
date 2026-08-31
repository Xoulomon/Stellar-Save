/**
 * Balance Assertion Helpers
 * =========================
 * Shared utility functions for verifying that concurrent deposit load tests
 * produce no balance drift or lost updates.
 *
 * Imported by concurrent-deposits.js and any future load scenarios.
 */

/**
 * Fetches the current group balance from the API.
 * @param {string} baseUrl  - API base URL
 * @param {string} groupId  - Group identifier
 * @returns {{ balance: number, accepted: number, cycle: number } | null}
 */
export function fetchGroupBalance(baseUrl, groupId) {
  // k6 http is imported in the calling module; we return a parsed object
  // so callers don't need to parse JSON themselves.
  const http = require('k6/http'); // dynamic import for module compat
  const res = http.get(`${baseUrl}/api/v1/groups/${groupId}/balance`, {
    headers: { Accept: 'application/json' },
    tags: { operation: 'balance_check' },
  });

  if (res.status !== 200) return null;
  try {
    const body = JSON.parse(res.body);
    return {
      balance:  body.balance_stroops          || 0,
      accepted: body.accepted_contributions   || 0,
      cycle:    body.current_cycle            || 0,
    };
  } catch (_) {
    return null;
  }
}

/**
 * Asserts that the final balance equals expected value.
 * Records the drift as a k6 Gauge metric.
 *
 * @param {object} params
 * @param {number} params.initial          - Balance before the test (stroops)
 * @param {number} params.final            - Balance after the test (stroops)
 * @param {number} params.acceptedDeposits - Number of deposits accepted by server
 * @param {number} params.amountPerDeposit - Contribution amount in stroops
 * @returns {{ drift: number, pass: boolean }}
 */
export function assertNoBalanceDrift({ initial, final, acceptedDeposits, amountPerDeposit }) {
  const expected = initial + acceptedDeposits * amountPerDeposit;
  const drift    = Math.abs(final - expected);
  return {
    drift,
    pass:     drift === 0,
    expected,
    actual:   final,
    message:  drift === 0
      ? `✅ Balance integrity confirmed: ${final} stroops`
      : `❌ Balance drift of ${drift} stroops (expected ${expected}, got ${final}). ` +
        `${(drift / amountPerDeposit).toFixed(2)} contribution(s) lost or double-counted.`,
  };
}

/**
 * Calculates the expected group balance for a given number of deposits
 * when no payouts have occurred in the current cycle.
 *
 * @param {number} memberCount        - Number of members who contributed
 * @param {number} amountPerMember    - Contribution per member in stroops
 * @param {number} priorBalance       - Balance before this cycle's contributions
 * @returns {number} Expected balance in stroops
 */
export function expectedCycleBalance(memberCount, amountPerMember, priorBalance = 0) {
  return priorBalance + memberCount * amountPerMember;
}
