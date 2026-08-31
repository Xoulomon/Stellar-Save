import { IpfsClient } from './client';
import { PinningService } from './pinning_service';
import { PinningQueue } from './pinning_queue';
import { logger } from '../logger';

export interface IpfsMonitorAlert {
  id: string;
  type: 'node_unreachable' | 'pin_failure' | 'pin_missing' | 'queue_stalled';
  message: string;
  cid?: string;
  groupId?: string;
  timestamp: number;
  acknowledged: boolean;
}

export class IpfsMonitor {
  private ipfs: IpfsClient;
  private pinning: PinningService;
  private monitorTimer: ReturnType<typeof setInterval> | null = null;
  private alerts: IpfsMonitorAlert[] = [];
  private checkIntervalMs: number;

  constructor(ipfs?: IpfsClient, pinning?: PinningService, checkIntervalMs = 60000) {
    this.ipfs = ipfs ?? new IpfsClient();
    this.pinning = pinning ?? new PinningService(this.ipfs);
    this.checkIntervalMs = checkIntervalMs;
  }

  start(): void {
    if (this.monitorTimer) return;
    this.monitorTimer = setInterval(() => {
      this.runChecks().catch((err) => {
        logger.error('IPFS monitor check error', { error: String(err) });
      });
    }, this.checkIntervalMs);
    logger.info('IPFS monitor started', { checkIntervalMs: this.checkIntervalMs });
  }

  stop(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    logger.info('IPFS monitor stopped');
  }

  private async runChecks(): Promise<void> {
    await Promise.all([
      this.checkNodeHealth(),
      this.checkFailedJobs(),
      this.checkPinConsistency(),
      this.checkQueueStalled(),
    ]);
  }

  private async checkNodeHealth(): Promise<void> {
    const healthy = await this.ipfs.healthCheck();
    if (!healthy) {
      this.addAlert({
        type: 'node_unreachable',
        message: 'IPFS node is unreachable',
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }

  private async checkFailedJobs(): Promise<void> {
    const stats = await PinningQueue.getQueueStats();
    if (stats.failed > 0) {
      this.addAlert({
        type: 'pin_failure',
        message: `${stats.failed} pinning job(s) have failed`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }

  private async checkPinConsistency(): Promise<void> {
    const result = await this.pinning.verifyAllPins();
    if (result.missing > 0) {
      this.addAlert({
        type: 'pin_missing',
        message: `${result.missing} of ${result.total} tracked CID(s) are missing from the IPFS node`,
        timestamp: Date.now(),
        acknowledged: false,
      });
    }
  }

  private async checkQueueStalled(): Promise<void> {
    const stats = await PinningQueue.getQueueStats();
    if (stats.processing > 0) {
      const ipfsReady = await this.ipfs.healthCheck();
      if (ipfsReady) {
        this.addAlert({
          type: 'queue_stalled',
          message: `${stats.processing} job(s) stuck in processing state`,
          timestamp: Date.now(),
          acknowledged: false,
        });
      }
    }
  }

  private addAlert(alert: Omit<IpfsMonitorAlert, 'id'>): void {
    const existing = this.alerts.find(
      (a) => a.type === alert.type && !a.acknowledged,
    );
    if (existing) return;

    const newAlert: IpfsMonitorAlert = {
      ...alert,
      id: `${alert.type}-${alert.timestamp}`,
    };
    this.alerts.push(newAlert);

    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-500);
    }

    logger.warn('IPFS monitor alert', { alert: newAlert });
  }

  getAlerts(unacknowledgedOnly = false): IpfsMonitorAlert[] {
    if (unacknowledgedOnly) {
      return this.alerts.filter((a) => !a.acknowledged);
    }
    return [...this.alerts];
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  acknowledgeByType(type: IpfsMonitorAlert['type']): number {
    let count = 0;
    for (const alert of this.alerts) {
      if (alert.type === type && !alert.acknowledged) {
        alert.acknowledged = true;
        count++;
      }
    }
    return count;
  }
}
