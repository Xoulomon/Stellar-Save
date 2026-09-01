/**
 * MSW handlers for the Stellar Horizon REST API.
 *
 * These intercept `fetch` calls that go to:
 *   - https://horizon-testnet.stellar.org
 *   - https://horizon.stellar.org
 *   - https://horizon-futurenet.stellar.org
 *
 * Handlers are intentionally generic so that any test can override
 * specific endpoints with `server.use(...)` without touching the defaults.
 *
 * @see docs/msw-handlers.md for the handler-adding convention.
 */

import { http, HttpResponse } from 'msw';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const HORIZON_ORIGINS = [
  'https://horizon-testnet.stellar.org',
  'https://horizon.stellar.org',
  'https://horizon-futurenet.stellar.org',
];

/**
 * A minimal Horizon payments page used as the default happy-path fixture.
 * Override per-test with `server.use(horizonHandlers.payments(records))`.
 */
export const DEFAULT_PAYMENTS_PAGE = {
  _embedded: {
    records: [
      {
        id: 'pmt_default_1',
        type: 'payment',
        created_at: '2026-04-20T10:30:00Z',
        transaction_hash: 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1',
        amount: '250.0000000',
        asset_code: 'XLM',
        asset_type: 'native',
        from: 'GASENDER1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        to: 'GARECIPIENT1234567890ABCDEFGHIJKLMNOPQRST',
        memo: 'Group contribution',
      },
      {
        id: 'pmt_default_2',
        type: 'payment',
        created_at: '2026-04-15T14:22:00Z',
        transaction_hash: 'def456ghi789def456ghi789def456ghi789def456ghi789def456ghi789def4',
        amount: '1000.0000000',
        asset_code: 'USDC',
        asset_type: 'credit_alphanum4',
        from: 'GASENDER2ABCDEFGHIJKLMNOPQRSTUVWXYZ12345',
        to: 'GARECIPIENT2ABCDEFGHIJKLMNOPQRSTUVWXYZ1234',
        memo: 'Payout',
      },
    ],
  },
  _links: {
    self: { href: '' },
    next: { href: '' },
    prev: { href: '' },
  },
};

export const DEFAULT_ACCOUNT = {
  id: 'GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN',
  balances: [{ asset_type: 'native', balance: '100.0000000' }],
  sequence: '0',
};

// ── Handler factories ─────────────────────────────────────────────────────────

/**
 * Returns an array of `http` handlers that cover the default Horizon endpoints
 * used across the test suite.
 *
 * Registered in the server as fallback defaults; tests can override with
 * `server.use(http.get(...))` inside `beforeEach` / individual tests.
 */
export function createHorizonHandlers() {
  return HORIZON_ORIGINS.flatMap((origin) => [
    // Payments for an account
    http.get(`${origin}/accounts/:accountId/payments`, () => {
      return HttpResponse.json(DEFAULT_PAYMENTS_PAGE);
    }),

    // Account details
    http.get(`${origin}/accounts/:accountId`, () => {
      return HttpResponse.json(DEFAULT_ACCOUNT);
    }),

    // Transactions for an account
    http.get(`${origin}/accounts/:accountId/transactions`, () => {
      return HttpResponse.json({ _embedded: { records: [] } });
    }),

    // Generic fee stats (used by the SDK when building transactions)
    http.get(`${origin}/fee_stats`, () => {
      return HttpResponse.json({
        last_ledger: '1000',
        last_ledger_base_fee: '100',
        ledger_usage_rate: '0.5',
        fee_charged: { max: '100', min: '100', mode: '100', p10: '100', p20: '100', p30: '100', p40: '100', p50: '100', p60: '100', p70: '100', p80: '100', p90: '100', p95: '100', p99: '100' },
        max_fee: { max: '100', min: '100', mode: '100', p10: '100', p20: '100', p30: '100', p40: '100', p50: '100', p60: '100', p70: '100', p80: '100', p90: '100', p95: '100', p99: '100' },
      });
    }),
  ]);
}
