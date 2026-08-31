/**
 * stellarService.ts
 *
 * Service layer that wraps all Stellar Horizon API interactions.
 *
 * Why this exists:
 * - Keeps `@stellar/stellar-sdk` imports out of components and hooks
 * - Provides a single place to switch Horizon URLs or SDK versions
 * - Makes unit testing trivial: mock this module, not the SDK
 *
 * Components and hooks should import from this file, NOT directly from
 * `@stellar/stellar-sdk`.
 *
 * @example
 * ```ts
 * import { stellarService } from '../lib/stellarService';
 *
 * const account = await stellarService.loadAccount(address, 'TESTNET');
 * const payments = await stellarService.fetchPayments(address, 'TESTNET', { limit: 50 });
 * ```
 */

import { Horizon } from '@stellar/stellar-sdk';

// ── Types ─────────────────────────────────────────────────────────────────────

export type NetworkName = 'PUBLIC' | 'MAINNET' | 'TESTNET' | 'FUTURENET' | string;

/** Minimal Stellar account balance as returned by Horizon */
export interface AccountBalance {
  asset_type: string;
  balance: string;
  asset_code?: string;
  asset_issuer?: string;
}

/** Minimal Stellar account info */
export interface AccountInfo {
  id: string;
  balances: AccountBalance[];
  sequence: string;
}

/** Options for fetchPayments */
export interface FetchPaymentsOptions {
  /** Number of records to fetch (1–200). Defaults to 50. */
  limit?: number;
  /** Sort order. Defaults to 'desc'. */
  order?: 'asc' | 'desc';
  /** Optional cursor for paging */
  cursor?: string;
}

/** Raw Horizon payment record shape used by this service */
export interface HorizonPaymentRecord {
  id: string;
  type: string;
  created_at: string;
  transaction_hash: string;
  amount?: string;
  source_amount?: string;
  asset_code?: string;
  asset_type?: string;
  from?: string;
  to?: string;
  memo?: string;
  // used by path-payment operations
  destination_asset_code?: string;
  destination_asset_type?: string;
}

// ── Horizon URL map ───────────────────────────────────────────────────────────

const HORIZON_URLS: Record<string, string> = {
  PUBLIC:    'https://horizon.stellar.org',
  MAINNET:   'https://horizon.stellar.org',
  TESTNET:   'https://horizon-testnet.stellar.org',
  FUTURENET: 'https://horizon-futurenet.stellar.org',
};

function getHorizonUrl(network: NetworkName): string {
  return HORIZON_URLS[network] ?? HORIZON_URLS['TESTNET'];
}

// ── StellarService class ──────────────────────────────────────────────────────

/**
 * Thin service wrapper around Horizon.Server.
 *
 * All SDK imports are confined here; tests can `vi.mock('../lib/stellarService')`
 * without touching the SDK at all.
 */
export class StellarService {
  /**
   * Returns a Horizon.Server instance for the given network.
   * Marked as protected so sub-classes (or tests via spying) can override it.
   */
  protected getServer(network: NetworkName): Horizon.Server {
    return new Horizon.Server(getHorizonUrl(network));
  }

  /**
   * Load a Stellar account's info (balances, sequence number).
   *
   * @throws If the account does not exist on the network (HTTP 404).
   */
  async loadAccount(address: string, network: NetworkName): Promise<AccountInfo> {
    const server = this.getServer(network);
    const account = await server.loadAccount(address);
    return {
      id: account.id,
      balances: account.balances as AccountBalance[],
      sequence: account.sequenceNumber(),
    };
  }

  /**
   * Fetch the XLM (native) balance for an account.
   * Returns `null` when the account is not found.
   */
  async getXlmBalance(
    address: string,
    network: NetworkName,
  ): Promise<string | null> {
    const account = await this.loadAccount(address, network);
    const xlmEntry = account.balances.find(
      (b) => b.asset_type === 'native',
    );
    return xlmEntry?.balance ?? null;
  }

  /**
   * Fetch the complete list of balances (all assets) for an account.
   * Returns an empty array when the account is not found.
   */
  async getAllBalances(
    address: string,
    network: NetworkName,
  ): Promise<AccountBalance[]> {
    const account = await this.loadAccount(address, network);
    return account.balances;
  }

  /**
   * Fetch payment operations for an account.
   *
   * Returns the raw Horizon payment records (not mapped to our domain type —
   * callers like `useUserProfile` and `TransactionHistory` do the mapping).
   */
  async fetchPayments(
    address: string,
    network: NetworkName,
    options: FetchPaymentsOptions = {},
  ): Promise<HorizonPaymentRecord[]> {
    const { limit = 50, order = 'desc', cursor } = options;

    const server = this.getServer(network);
    let builder = server.payments().forAccount(address).order(order).limit(limit);

    if (cursor) {
      builder = builder.cursor(cursor);
    }

    const page = await builder.call();
    return (page.records ?? []) as HorizonPaymentRecord[];
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

/** Application-wide StellarService singleton. Import this in hooks and components. */
export const stellarService = new StellarService();

export default stellarService;
