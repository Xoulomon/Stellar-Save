import crypto from 'crypto';
import { BackupService } from './backup_service';
import { BackupAlert } from './models';

export interface MonitorConfig {
  maxBackupAgeMs: number;       // alert if latest backup is older than this (default: 25h)
  checkIntervalMs: number;      // how often to run checks (default: 30min)
  alertWebhookUrl?: string;     // optional webhook for alert delivery
}

const DEFAULT_CONFIG: MonitorConfig = {
  maxBackupAgeMs: 25 * 60 * 60 * 1000,
  checkIntervalMs: 30 * 60 * 1000,
};

export class BackupMonitor {
  private config: MonitorConfig;
  private service: BackupService;
  private alerts: BackupAlert[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(service: BackupService, config: Partial<MonitorConfig> = {}) {
    this.service = service;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    this.timer = setInterval(() => this.runChecks(), this.config.checkIntervalMs);
    console.log('[BackupMonitor] Started, checking every', this.config.checkIntervalMs / 60000, 'min');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  async runChecks(): Promise<BackupAlert[]> {
    const newAlerts: BackupAlert[] = [];

    // Check 1: any failed backup jobs
    const failed = this.service.listJobs().filter(j => j.status === 'failed');
    for (const job of failed) {
      if (!this.alerts.find(a => a.backupJobId === job.id && a.level === 'error')) {
        newAlerts.push(this.createAlert(job.id, 'error', `Backup job ${job.id} failed: ${job.error ?? 'unknown error'}`));
      }
    }

    // Check 2: latest full backup is too old
    const latest = this.service.getLatestCompleted('full');
    if (!latest) {
      newAlerts.push(this.createAlert('none', 'warning', 'No completed full backup found'));
    } else if (Date.now() - latest.createdAt > this.config.maxBackupAgeMs) {
      const ageH = Math.round((Date.now() - latest.createdAt) / 3600000);
      newAlerts.push(this.createAlert(latest.id, 'warning', `Latest full backup is ${ageH}h old (threshold: ${this.config.maxBackupAgeMs / 3600000}h)`));
    }

    this.alerts.push(...newAlerts);

    for (const alert of newAlerts) {
      console.warn(`[BackupMonitor] [${alert.level.toUpperCase()}] ${alert.message}`);
      await this.sendWebhook(alert);
    }

    return newAlerts;
  }

  getAlerts(unacknowledgedOnly = false): BackupAlert[] {
    return unacknowledgedOnly ? this.alerts.filter(a => !a.acknowledged) : [...this.alerts];
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  private createAlert(backupJobId: string, level: 'warning' | 'error', message: string): BackupAlert {
    return { id: crypto.randomUUID(), backupJobId, level, message, timestamp: Date.now(), acknowledged: false };
  }

  private async sendWebhook(alert: BackupAlert): Promise<void> {
    if (!this.config.alertWebhookUrl) return;
    try {
      await fetch(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (err) {
      console.error('[BackupMonitor] Webhook delivery failed:', err);
    }
  }
}
