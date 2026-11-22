import { http, HttpResponse } from 'msw';

/**
 * Shared MSW handlers for Horizon and Soroban RPC endpoints.
 *
 * Tests should import these handlers (via the shared server in `./server`)
 * instead of defining their own inline fetch mocks, so that the same endpoint
 * returns consistent, realistic responses across the suite. Per-test overrides
 * can be applied with `server.use(...)`.
 */

export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';

export interface HorizonAccountResponse {
  id: string;
  account_id: string;
  sequence: string;
  subentry_count: number;
  balances: Array<{
    balance: string;
    asset_type: string;
    asset_code?: string;
    asset_issuer?: string;
  }>;
  thresholds: { low_threshold: number; med_threshold: number; high_threshold: number };
  flags: { auth_required: boolean; auth_revocable: boolean; auth_immutable: boolean };
  signers: Array<{ weight: number; key: string; type: string }>;
  data: Record<string, string>;
}

export interface HorizonTransactionResponse {
  _links: Record<string, { href: string }>;
  _embedded: { records: HorizonTransactionRecord[] };
}

export interface HorizonTransactionRecord {
  id: string;
  hash: string;
  ledger: number;
  created_at: string;
  source_account: string;
  successful: boolean;
  fee_charged: string;
  operation_count: number;
}

export interface SorobanSimulateResponse {
  jsonrpc: '2.0';
  id: number | string;
  result?: {
    transactionData: string;
    minResourceFee: string;
    cost: { cpuInsns: string; memBytes: string };
    latestLedger: number;
    events: string[];
    results?: Array<{ auth: string[]; xdr: string }>;
  };
  error?: { code: number; message: string; data?: unknown };
}

export const DEFAULT_ACCOUNT_ID =
  'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

export const defaultAccount: HorizonAccountResponse = {
  id: DEFAULT_ACCOUNT_ID,
  account_id: DEFAULT_ACCOUNT_ID,
  sequence: '123456789012345678',
  subentry_count: 0,
  balances: [
    {
      balance: '1000.0000000',
      asset_type: 'native',
    },
  ],
  thresholds: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
  flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
  signers: [{ weight: 1, key: DEFAULT_ACCOUNT_ID, type: 'ed25519_public_key' }],
  data: {},
};

export const defaultTransactions: HorizonTransactionResponse = {
  _links: {
    self: { href: `${HORIZON_URL}/accounts/${DEFAULT_ACCOUNT_ID}/transactions` },
    next: { href: `${HORIZON_URL}/accounts/${DEFAULT_ACCOUNT_ID}/transactions?cursor=1` },
    prev: { href: `${HORIZON_URL}/accounts/${DEFAULT_ACCOUNT_ID}/transactions?cursor=0` },
  },
  _embedded: {
    records: [
      {
        id: '1',
        hash: 'a'.repeat(64),
        ledger: 1000,
        created_at: '2024-01-01T00:00:00Z',
        source_account: DEFAULT_ACCOUNT_ID,
        successful: true,
        fee_charged: '100',
        operation_count: 1,
      },
    ],
  },
};

export const defaultSimulateResult: SorobanSimulateResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    transactionData: 'AAAAAgAAAAB...',
    minResourceFee: '100',
    cost: { cpuInsns: '1000000', memBytes: '100000' },
    latestLedger: 1000,
    events: [],
    results: [{ auth: [], xdr: 'AAAAAQAAAAA...' }],
  },
};

export const handlers = [
  http.get(`${HORIZON_URL}/accounts/:accountId`, ({ params }) => {
    const accountId = String(params.accountId);
    const body: HorizonAccountResponse = { ...defaultAccount, id: accountId, account_id: accountId };
    return HttpResponse.json(body);
  }),

  http.get(`${HORIZON_URL}/accounts/:accountId/transactions`, () => {
    return HttpResponse.json(defaultTransactions);
  }),

  http.post(SOROBAN_RPC_URL, async ({ request }) => {
    const payload = (await request.json()) as { id?: number | string; method?: string };
    const id = payload?.id ?? 1;

    if (payload?.method === 'simulateTransaction') {
      const body: SorobanSimulateResponse = { ...defaultSimulateResult, id };
      return HttpResponse.json(body);
    }

    return HttpResponse.json({
      jsonrpc: '2.0',
      id,
      error: { code: -32601, message: `Method not mocked: ${payload?.method ?? 'unknown'}` },
    });
  }),
];
