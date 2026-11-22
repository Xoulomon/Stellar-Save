/**
 * Soroban RPC Client Service
 *
 * Wraps Soroban RPC calls and provides a unified interface for contract interactions.
 * Decouples business logic from network client details.
 */

import { withRetry } from '@stellar-save/shared-utils';

import { rpcRetryPolicy } from '../lib/retry_policies';
import { getSorobanPool } from '../lib/soroban';
import { logger } from '../logger';

import type { rpc as SorobanRpc } from '@stellar/stellar-sdk';

export interface SorobanClientConfig {
  timeoutMs?: number;
  retryAttempts?: number;
}

export class SorobanClient {
  private config: Required<SorobanClientConfig>;

  constructor(config: SorobanClientConfig = {}) {
    this.config = {
      timeoutMs: config.timeoutMs ?? 10000,
      retryAttempts: config.retryAttempts ?? 3,
    };
  }

  /**
   * Get transaction status from the Soroban RPC
   */
  async getTransaction(txHash: string): Promise<SorobanRpc.GetTransactionResponse | null> {
    return this.withRetry(() =>
      getSorobanPool().withClient((client) => client.getTransaction(txHash), 'getTransaction')
    );
  }

  /**
   * Simulate a contract invocation
   */
  async simulateTransaction(transaction: string): Promise<SorobanRpc.SimulateTransactionResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient(
        (client) => client.simulateTransaction(transaction),
        'simulateTransaction'
      )
    );
  }

  /**
   * Send a signed transaction to the Soroban RPC
   */
  async sendTransaction(transaction: string): Promise<SorobanRpc.SendTransactionResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient(
        (client) => client.sendTransaction(transaction),
        'sendTransaction'
      )
    );
  }

  /**
   * Get the latest ledger
   */
  async getLatestLedger(): Promise<SorobanRpc.GetLatestLedgerResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient((client) => client.getLatestLedger(), 'getLatestLedger')
    );
  }

  /**
   * Get network details
   */
  async getNetwork(): Promise<SorobanRpc.GetNetworkResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient((client) => client.getNetwork(), 'getNetwork')
    );
  }

  /**
   * Get health status of the RPC
   */
  async getHealth(): Promise<SorobanRpc.GetHealthResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient((client) => client.getHealth(), 'getHealth')
    );
  }

  /**
   * Get events by filters
   */
  async getEvents(options: SorobanRpc.GetEventsRequest): Promise<SorobanRpc.GetEventsResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient((client) => client.getEvents(options), 'getEvents')
    );
  }

  /**
   * Get ledger entries
   */
  async getLedgerEntries(...keys: string[]): Promise<SorobanRpc.GetLedgerEntriesResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient((client) => client.getLedgerEntries(...keys), 'getLedgerEntries')
    );
  }

  /**
   * Request a cost estimate for simulation
   */
  async requestCostEstimate(transaction: string): Promise<SorobanRpc.CostEstimate> {
    return this.withRetry(async () => {
      const response = await getSorobanPool().withClient(
        (client) => client.simulateTransaction(transaction),
        'requestCostEstimate'
      );
      if (!('cost' in response)) {
        throw new Error('Failed to get cost estimate from simulation response');
      }
      return response.cost;
    });
  }

  /**
   * Retry logic for RPC calls using shared withRetry utility and rpcRetryPolicy
   */
  private async withRetry<T>(fn: () => Promise<T>): Promise<T> {
    return withRetry(
      async () => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(
              () => reject(new Error(`RPC call timed out after ${this.config.timeoutMs}ms`)),
              this.config.timeoutMs
            );
          });
          return await Promise.race([fn(), timeoutPromise]);
        } finally {
          if (timer) clearTimeout(timer);
        }
      },
      {
        ...rpcRetryPolicy,
        attempts: this.config.retryAttempts,
        onRetry: ({ attempt, error }) => {
          logger.warn(
            `Soroban RPC call failed, retrying (attempt ${attempt + 1}/${this.config.retryAttempts})`,
            {
              error: error instanceof Error ? error.message : String(error),
            }
          );
        },
      }
    ).catch((error: unknown) => {
      logger.error('Soroban RPC call failed after retries', {
        error: error instanceof Error ? error.message : String(error),
        attempts: this.config.retryAttempts,
      });
      throw error;
    });
  }
}

let _client: SorobanClient | null = null;

export function getSorobanClient(config?: SorobanClientConfig): SorobanClient {
  if (!_client) {
    _client = new SorobanClient(config);
  }
  return _client;
}

export function resetSorobanClient(): void {
  _client = null;
}
