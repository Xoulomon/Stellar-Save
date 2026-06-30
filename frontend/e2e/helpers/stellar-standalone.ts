import { Page } from '@playwright/test';

const RPC_URL = process.env['STELLAR_RPC_URL'] ?? 'http://localhost:8000/soroban/rpc';
const HORIZON_URL = process.env['HORIZON_URL'] ?? 'http://localhost:8000';
const NETWORK_PASSPHRASE = process.env['STELLAR_NETWORK_PASSPHRASE'] ?? 'Standalone Network ; February 2017';

/** Funded test keypairs on the standalone network (well-known standalone keys). */
export const TEST_ACCOUNTS = {
  creator: {
    publicKey: 'GBZXN7PIRZGNMHGA7MUUUF4GWPY5AYPGOZ3ZZBY4RNGRUK6YHPZDZES',
    secretKey: 'SC5O7VZUXDJ57JMKA46MRZM19YGKBKUPTZKI7BKBVSASAMHCHC4MAQM',
  },
  member1: {
    publicKey: 'GAIH3ULLFQ4DGSECF2AR555KZ4KNDGEKN4AFI4SU2M7B43MGK3QJZNSR',
    secretKey: 'SCZANGBA5RLCQ57XMFFQ5YWKXHXEQKUHNKKZEQ5XKXYODEDLC4WD44P',
  },
} as const;

/**
 * Injects a mock Freighter wallet into the page for the given account.
 * The mock auto-approves all sign requests.
 */
export async function injectMockWallet(page: Page, account: keyof typeof TEST_ACCOUNTS): Promise<void> {
  const { publicKey } = TEST_ACCOUNTS[account];
  await page.addInitScript((pk: string) => {
    const freighter = {
      isConnected: () => Promise.resolve(true),
      isAllowed: () => Promise.resolve(true),
      getPublicKey: () => Promise.resolve(pk),
      getNetwork: () => Promise.resolve('STANDALONE'),
      getNetworkDetails: () => Promise.resolve({
        network: 'STANDALONE',
        networkPassphrase: 'Standalone Network ; February 2017',
        networkUrl: 'http://localhost:8000',
        sorobanRpcUrl: 'http://localhost:8000/soroban/rpc',
      }),
      signTransaction: (_xdr: string, _opts: unknown) => Promise.resolve(_xdr),
      signAuthEntry: (_xdr: string) => Promise.resolve(_xdr),
    };
    (window as unknown as Record<string, unknown>)['freighter'] = freighter;
    (window as unknown as Record<string, unknown>)['freighterApi'] = freighter;
  }, publicKey);
}

/**
 * Waits for the standalone Stellar network to be ready by polling the Horizon health endpoint.
 */
export async function waitForNetwork(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${HORIZON_URL}/`);
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error(`Stellar standalone network not ready at ${HORIZON_URL} after ${timeoutMs}ms`);
}

export { RPC_URL, HORIZON_URL, NETWORK_PASSPHRASE };
