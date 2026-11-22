import crypto from 'crypto';

import { fetchWithCorrelationId } from './lib/http';
import { logger } from './logger';

import type { BackupService } from './backup_service';
import type { BackupAlert } from './models';


export interface MonitorConfig {
  maxBackupAgeMs: number; // alert if latest backup is older than this (default: 25h)
  checkIntervalMs: number; // how often to run checks (default: 30min) - now informational only
  alertWebhookUrl?: string; // optional webhook for alert delivery
}

const DEFAULT_CONFIG: MonitorConfig = {
  maxBackupAgeMs: 25 * 60 * 60 * 1000,
  checkIntervalMs: 30 * 60 * 1000,
};

export class BackupMonitor {
  private config: MonitorConfig;
  private service: BackupService;
  private alerts: BackupAlert[] = [];

  constructor(service: BackupService, config: Partial<MonitorConfig> = {}) {
    this.service = service;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Run health checks and return generated alerts.
   * Called by BackupOrchestrator on its timer; this class owns no lifecycle.
   */
  async runChecks(): Promise<BackupAlert[]> {
    const newAlerts = this.evaluate();

    this.alerts.push(...newAlerts);

    for (const alert of newAlerts) {
      logger.warn(`[BackupMonitor] [${alert.level.toUpperCase()}] ${alert.message}`);
      await this.sendWebhook(alert);
    }

    return newAlerts;
  }

  /**
   * Pure evaluation of all health checks without mutating tracked state.
   * Combines failed-job and stale-backup checks in a single pass.
   */
  private evaluate(): BackupAlert[] {
    return [...this.checkFailedJobs(), ...this.checkStaleBackups()];
  }

  /**
   * Check if there are failed jobs without existing alerts.
   * Returns alerts for failed jobs not yet tracked.
   */
  checkFailedJobs(): BackupAlert[] {
    const alerts: BackupAlert[] = [];
    const failed = this.service.listJobs().filter((j) => j.status === 'failed');
    for (const job of failed) {
      if (!this.alerts.find((a) => a.backupJobId === job.id && a.level === 'error')) {
        const alert = this.createAlert(
          job.id,
          'error',
          `Backup job ${job.id} failed: ${job.error ?? 'unknown error'}`
        );
        alerts.push(alert);
      }
    }
    return alerts;
  }

  /**
   * Check if backups are getting stale.
   * Returns alerts if latest backup is too old.
   */
  checkStaleBackups(): BackupAlert[] {
    const alerts: BackupAlert[] = [];
    const latest = this.service.getLatestCompleted('full');
    if (!latest) {
      alerts.push(this.createAlert('none', 'warning', 'No completed full backup found'));
    } else if (Date.now() - latest.createdAt > this.config.maxBackupAgeMs) {
      const ageH = Math.round((Date.now() - latest.createdAt) / 3600000);
      alerts.push(
        this.createAlert(
          latest.id,
          'warning',
          `Latest full backup is ${ageH}h old (threshold: ${this.config.maxBackupAgeMs / 3600000}h)`
        )
      );
    }
    return alerts;
  }

  getAlerts(unacknowledgedOnly = false): BackupAlert[] {
    return unacknowledgedOnly ? this.alerts.filter((a) => !a.acknowledged) : [...this.alerts];
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  private createAlert(
    backupJobId: string,
    level: 'warning' | 'error',
    message: string
  ): BackupAlert {
    return {
      id: crypto.randomUUID(),
      backupJobId,
      level,
      message,
      timestamp: Date.now(),
      acknowledged: false,
    };
  }

  private async sendWebhook(alert: BackupAlert): Promise<void> {
    if (!this.config.alertWebhookUrl) return;
    try {
      await fetchWithCorrelationId(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (err) {
      logger.error('[BackupMonitor] Webhook delivery failed:', err);
    }
  }
}
