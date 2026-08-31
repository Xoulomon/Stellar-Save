/**
 * explorerUrl.ts
 *
 * Derives Stellar Expert explorer URLs from the configured network.
 * VITE_STELLAR_NETWORK → one of: testnet | mainnet | futurenet | standalone
 */

import { env, type StellarNetwork } from '../lib/env';

/** Maps Stellar network names to stellar.expert path segments. */
const EXPLORER_NETWORKS: Record<StellarNetwork, string> = {
  mainnet: 'public',
  testnet: 'testnet',
  futurenet: 'futurenet',
  standalone: 'testnet', // no explorer for standalone; fall back to testnet
};

function resolveNetwork(): StellarNetwork {
  // Already validated against this exact set of values by env.ts.
  return env.VITE_STELLAR_NETWORK;
}

const BASE = 'https://stellar.expert/explorer';

/** Returns the Stellar Expert URL for a transaction hash on the configured network. */
export function getExplorerTxUrl(txHash: string): string {
  return `${BASE}/${EXPLORER_NETWORKS[resolveNetwork()]}/tx/${txHash}`;
}

/** Returns the Stellar Expert URL for an account/address on the configured network. */
export function getExplorerAccountUrl(address: string): string {
  return `${BASE}/${EXPLORER_NETWORKS[resolveNetwork()]}/account/${address}`;
}

/**
 * Generic helper — pass the resource type and id.
 * e.g. getExplorerUrl('tx', hash)  or  getExplorerUrl('account', addr)
 */
export function getExplorerUrl(type: 'tx' | 'account' | 'contract', id: string): string {
  return `${BASE}/${EXPLORER_NETWORKS[resolveNetwork()]}/${type}/${id}`;
}
