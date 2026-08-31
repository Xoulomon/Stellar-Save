/**
 * Soroban RPC Client Service
 *
 * Wraps Soroban RPC calls and provides a unified interface for contract interactions.
 * Decouples business logic from network client details.
 */

import { rpc as SorobanRpc } from '@stellar/stellar-sdk';
import { getSorobanPool } from '../lib/soroban';
import { logger } from '../logger';

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
      getSorobanPool().withClient(
        (client) => client.getTransaction(txHash),
        'getTransaction'
      )
    );
  }

  /**
   * Simulate a contract invocation
   */
  async simulateTransaction(
    transaction: string
  ): Promise<SorobanRpc.SimulateTransactionResponse> {
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
      getSorobanPool().withClient(
        (client) => client.getLatestLedger(),
        'getLatestLedger'
      )
    );
  }

  /**
   * Get network details
   */
  async getNetwork(): Promise<SorobanRpc.GetNetworkResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient(
        (client) => client.getNetwork(),
        'getNetwork'
      )
    );
  }

  /**
   * Get health status of the RPC
   */
  async getHealth(): Promise<SorobanRpc.GetHealthResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient(
        (client) => client.getHealth(),
        'getHealth'
      )
    );
  }

  /**
   * Get events by filters
   */
  async getEvents(options: SorobanRpc.GetEventsRequest): Promise<SorobanRpc.GetEventsResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient(
        (client) => client.getEvents(options),
        'getEvents'
      )
    );
  }

  /**
   * Get ledger entries
   */
  async getLedgerEntries(
    ...keys: string[]
  ): Promise<SorobanRpc.GetLedgerEntriesResponse> {
    return this.withRetry(() =>
      getSorobanPool().withClient(
        (client) => client.getLedgerEntries(...keys),
        'getLedgerEntries'
      )
    );
  }

  /**
   * Request a cost estimate for simulation
   */
  async requestCostEstimate(
    transaction: string
  ): Promise<SorobanRpc.CostEstimate> {
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
   * Retry logic for RPC calls
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    attempt: number = 1
  ): Promise<T> {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error(`RPC call timed out after ${this.config.timeoutMs}ms`)),
          this.config.timeoutMs
        )
      );

      return await Promise.race([fn(), timeoutPromise]);
    } catch (error) {
      if (attempt < this.config.retryAttempts) {
        logger.warn(`Soroban RPC call failed, retrying (attempt ${attempt}/${this.config.retryAttempts})`, {
          error: error instanceof Error ? error.message : String(error),
        });
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, backoffMs));
        return this.withRetry(fn, attempt + 1);
      }
      logger.error('Soroban RPC call failed after retries', {
        error: error instanceof Error ? error.message : String(error),
        attempts: this.config.retryAttempts,
      });
      throw error;
    }
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
