import crypto from 'crypto';
import { BackupService, S3Client } from './backup_service';
import { RecoveryService, RestoreTarget } from './recovery_service';
import {
  backupRestoreDrillDuration,
  backupRestoreDrillsTotal,
  backupRestoreLastSuccessfulTimestamp,
} from './metrics';
import { logger } from './logger';
import { fetchWithCorrelationId } from './lib/http';

export interface RestoreDrillConfig {
  checkIntervalMs: number;
  maxRestoreDurationMs: number;
  alertWebhookUrl?: string;
}

export interface RestoreDrillAlert {
  id: string;
  level: 'warning' | 'error';
  message: string;
  timestamp: number;
  backupJobId?: string;
  restoredAt?: number;
  durationMs?: number;
  acknowledged: boolean;
}

export interface RestoreDrillRun {
  id: string;
  backupJobId?: string;
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  status: 'running' | 'passed' | 'failed';
  recordCount?: number;
  checksum?: string;
  restoreDurationMs?: number;
  integrityChecks: string[];
  error?: string;
}

class EphemeralRestoreTarget implements RestoreTarget {
  public snapshot: Record<string, unknown> | null = null;

  async applyFull(payload: Record<string, unknown>): Promise<void> {
    this.snapshot = payload;
  }

  async applyIncremental(_baseJobId: string, delta: Record<string, unknown>): Promise<void> {
    this.snapshot = delta;
  }
}

function createAlert(
  level: 'warning' | 'error',
  message: string,
  backupJobId?: string,
  run?: RestoreDrillRun,
): RestoreDrillAlert {
  return {
    id: crypto.randomUUID(),
    level,
    message,
    timestamp: Date.now(),
    backupJobId,
    restoredAt: run?.completedAt,
    durationMs: run?.durationMs,
    acknowledged: false,
  };
}

export class BackupRestoreDrill {
  private readonly backupService: BackupService;
  private readonly recovery: RecoveryService;
  private readonly target = new EphemeralRestoreTarget();
  private readonly config: RestoreDrillConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private runs: RestoreDrillRun[] = [];
  private alerts: RestoreDrillAlert[] = [];

  constructor(backupService: BackupService, s3Client: S3Client, config: RestoreDrillConfig) {
    this.backupService = backupService;
    this.recovery = new RecoveryService(backupService, s3Client, this.target);
    this.config = config;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    void this.runDrill();
    this.timer = setInterval(() => {
      void this.runDrill();
    }, this.config.checkIntervalMs);
    logger.info('backup restore drill started', {
      check_interval_ms: this.config.checkIntervalMs,
      max_restore_duration_ms: this.config.maxRestoreDurationMs,
    });
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.running = false;
    logger.info('backup restore drill stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  listRuns(): RestoreDrillRun[] {
    return [...this.runs].sort((a, b) => b.startedAt - a.startedAt);
  }

  listAlerts(unacknowledgedOnly = false): RestoreDrillAlert[] {
    return unacknowledgedOnly
      ? this.alerts.filter((alert) => !alert.acknowledged)
      : [...this.alerts];
  }

  acknowledge(alertId: string): boolean {
    const alert = this.alerts.find((entry) => entry.id === alertId);
    if (!alert) return false;
    alert.acknowledged = true;
    return true;
  }

  private async sendAlert(alert: RestoreDrillAlert): Promise<void> {
    if (!this.config.alertWebhookUrl) return;
    try {
      await fetchWithCorrelationId(this.config.alertWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alert),
      });
    } catch (err) {
      logger.error('backup restore drill alert delivery failed', {
        restore_drill_alert_id: alert.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async runDrill(): Promise<RestoreDrillRun> {
    const run: RestoreDrillRun = {
      id: crypto.randomUUID(),
      startedAt: Date.now(),
      status: 'running',
      integrityChecks: [],
    };
    this.runs.unshift(run);

    const failed = (message: string) => {
      run.status = 'failed';
      run.error = message;
      run.completedAt = Date.now();
      run.durationMs = run.completedAt - run.startedAt;
      backupRestoreDrillsTotal.inc({ status: 'failed' });
      backupRestoreDrillDuration.observe({ status: 'failed' }, run.durationMs / 1000);
      const alert = createAlert('error', message, run.backupJobId, run);
      this.alerts.unshift(alert);
      void this.sendAlert(alert);
      logger.error('backup restore drill failed', {
        backup_job_id: run.backupJobId,
        restore_drill_id: run.id,
        error: message,
        duration_ms: run.durationMs,
      });
      return run;
    };

    try {
      const latest = this.backupService.getLatestCompleted('full');
      if (!latest) {
        return failed('No completed full backup available for restore drill');
      }

      run.backupJobId = latest.id;
      logger.info('backup restore drill started', {
        backup_job_id: latest.id,
        restore_drill_id: run.id,
      });

      const restored = await this.recovery.restore(latest.id);
      const restoredPayload = this.target.snapshot;
      run.recordCount = restored.recordCount;
      run.checksum = restored.checksum;
      run.restoreDurationMs = restored.restoreDurationMs;
      run.integrityChecks.push('checksum-verified', 'payload-parsed', 'record-count-available');

      if (!restoredPayload) {
        return failed(`Restore drill did not materialise an ephemeral snapshot for backup ${latest.id}`);
      }

      const integrityIssues: string[] = [];
      if (latest.checksum && restored.checksum !== latest.checksum) {
        integrityIssues.push('checksum mismatch');
      }
      if (restored.recordCount < 0) {
        integrityIssues.push('invalid record count');
      }
      if (restored.restoreDurationMs > this.config.maxRestoreDurationMs) {
        integrityIssues.push(`restore exceeded RTO threshold (${restored.restoreDurationMs}ms > ${this.config.maxRestoreDurationMs}ms)`);
      }

      if (integrityIssues.length > 0) {
        return failed(`Restore drill integrity failure for backup ${latest.id}: ${integrityIssues.join('; ')}`);
      }

      run.status = 'passed';
      run.completedAt = Date.now();
      run.durationMs = run.completedAt - run.startedAt;
      backupRestoreDrillsTotal.inc({ status: 'passed' });
      backupRestoreDrillDuration.observe({ status: 'passed' }, run.durationMs / 1000);
      backupRestoreLastSuccessfulTimestamp.set(Math.floor(run.completedAt / 1000));
      logger.info('backup restore drill passed', {
        backup_job_id: latest.id,
        restore_drill_id: run.id,
        record_count: restored.recordCount,
        restore_duration_ms: restored.restoreDurationMs,
        duration_ms: run.durationMs,
      });
      return run;
    } catch (err) {
      return failed(err instanceof Error ? err.message : String(err));
    }
  }
}
