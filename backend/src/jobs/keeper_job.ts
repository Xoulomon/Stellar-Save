/**
 * Job scheduler for keeper/relayer service (Issue #1026, #1305, #1306).
 * Separates job scheduling from handler logic.
 */

import { CronJob } from 'cron';
import { logger } from '../logger';
import { IStellarClient, StellarClient } from '../lib/stellar_client';
import { KeeperHandler } from './handlers/keeper.handler';

export class KeeperJob {
  private contractId: string;
  private stellarClient: IStellarClient;
  private db: any;
  private task?: CronJob;
  private handler?: KeeperHandler;

  constructor(contractId: string, rpcUrlOrClient: string | IStellarClient, dbClient?: any) {
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
      this.runOnce().catch(err => logger.error('[keeper] runOnce uncaught error', { error: String(err) }));
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
    await this.handler.execute();
  }
}

export function startKeeperJob(
  schedule: string,
  contractId: string,
  rpcUrlOrClient: string | IStellarClient,
  dbClient?: any
): KeeperJob {
  const job = new KeeperJob(contractId, rpcUrlOrClient, dbClient);
  job.start(schedule);
  return job;
}
