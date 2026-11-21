/**
 * Job scheduler for keeper/relayer service (Issue #1026, #1305, #1306).
 * Separates job scheduling from handler logic.
 */

import { CronJob } from 'cron';

import { jobRetryPolicy, withRetry } from '../lib/retry_policies';
import { StellarClient } from '../lib/stellar_client';
import { logger } from '../logger';
import { KeeperHandler } from './handlers/keeper.handler';

import type { IStellarClient } from '../lib/stellar_client';

export class KeeperJob {
  private contractId: string;
  private stellarClient: IStellarClient;
  private db: unknown;
  private task?: CronJob;
  private handler?: KeeperHandler;
  /** Guards against overlapping runs (cron tick while a previous run is in flight). */
  private running = false;
  /** Dedupe key of the last successfully processed ledger/cursor. */
  private lastProcessedKey?: string;

  constructor(contractId: string, rpcUrlOrClient: string | IStellarClient, dbClient?: unknown) {
    this.contractId = contractId;
    if (typeof rpcUrlOrClient === 'string') {
      this.stellarClient = new StellarClient(rpcUrlOrClient);
    } else {
      this.stellarClient = rpcUrlOrClient;
    }
    this.db = dbClient;
  }

  start(schedule: string): void {
    this.handler = new KeeperHandler(this.contractId, this.stellarClient, this.db);
    this.task = new CronJob(schedule, () => {
      this.runOnce().catch((err) =>
        logger.error('[keeper] runOnce uncaught error', { error: String(err) })
      );
    });
    this.task.start();
    logger.info('[keeper] started', { schedule, contractId: this.contractId });
  }

  stop(): void {
    this.task?.stop();
    logger.info('[keeper] stopped');
  }

  async runOnce(): Promise<void> {
    if (!this.handler) {
      logger.error('[keeper] handler not initialized');
      return;
    }
    if (this.running) {
      logger.warn('[keeper] runOnce skipped: previous run still in progress', {
        contractId: this.contractId,
      });
      return;
    }

    this.running = true;
    try {
      const result = await withRetry(
        () => this.handler!.execute(),
        jobRetryPolicy,
        (err, attempt) =>
          logger.warn('[keeper] runOnce attempt failed, retrying', {
            contractId: this.contractId,
            attempt,
            error: String(err),
          })
      );

      const key = this.dedupeKey(result);
      if (key !== undefined && key === this.lastProcessedKey) {
        logger.info('[keeper] runOnce skipped: already processed', {
          contractId: this.contractId,
          key,
        });
        return;
      }
      if (key !== undefined) {
        this.lastProcessedKey = key;
      }
    } catch (err) {
      logger.error('[keeper] runOnce failed after retries', {
        contractId: this.contractId,
        error: String(err),
      });
      throw err;
    } finally {
      this.running = false;
    }
  }

  /**
   * Builds a dedupe key from the handler result (ledger/cursor) so repeated
   * executions for the same position are idempotent. Returns undefined when the
   * handler does not expose a position.
   */
  private dedupeKey(result: unknown): string | undefined {
    if (!result || typeof result !== 'object') {
      return undefined;
    }
    const { ledger, cursor } = result as { ledger?: unknown; cursor?: unknown };
    if (ledger === undefined && cursor === undefined) {
      return undefined;
    }
    return `${this.contractId}:${String(ledger ?? '')}:${String(cursor ?? '')}`;
  }
}

export function startKeeperJob(
  schedule: string,
  contractId: string,
  rpcUrlOrClient: string | IStellarClient,
  dbClient?: unknown
): KeeperJob {
  const job = new KeeperJob(contractId, rpcUrlOrClient, dbClient);
  job.start(schedule);
  return job;
}
