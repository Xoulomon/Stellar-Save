import { logger } from './logger';

import type { BackupService } from './backup_service';
import type { BackupJob } from './models';


export interface SchedulerConfig {
  fullBackupIntervalMs: number; // default: 24h
  incrementalIntervalMs: number; // default: 6h
}

const DEFAULT_CONFIG: SchedulerConfig = {
  fullBackupIntervalMs: 24 * 60 * 60 * 1000,
  incrementalIntervalMs: 6 * 60 * 60 * 1000,
};

/**
 * Pure helper: decide whether a full backup is due given the last run time.
 * Returns true when no previous run is recorded (lastRunTime === 0).
 */
export function isFullBackupDue(
  lastRunTime: number,
  intervalMs: number,
  now: number = Date.now(),
): boolean {
  if (lastRunTime <= 0) return true;
  return now - lastRunTime >= intervalMs;
}

/**
 * Pure helper: decide whether an incremental backup is due given the last run time.
 * Returns true when no previous run is recorded (lastRunTime === 0).
 */
export function isIncrementalBackupDue(
  lastRunTime: number,
  intervalMs: number,
  now: number = Date.now(),
): boolean {
  if (lastRunTime <= 0) return true;
  return now - lastRunTime >= intervalMs;
}

/**
 * Pure helper: compute ms remaining until the next scheduled run.
 */
export function msUntilNextRun(
  lastRunTime: number,
  intervalMs: number,
  now: number = Date.now(),
): number {
  if (lastRunTime <= 0) return 0;
  return Math.max(0, intervalMs - (now - lastRunTime));
}

/**
 * @deprecated Scheduling, monitoring, drilling and pruning are owned by
 * `lib/backup-orchestrator.ts`. This class is retained only for backwards
 * compatibility and delegates all scheduling decisions to pure helpers.
 * New code should use the orchestrator as the single entry point.
 */
export class BackupScheduler {
  private config: SchedulerConfig;
  private service: BackupService;

  constructor(service: BackupService, config: Partial<SchedulerConfig> = {}) {
    this.service = service;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if it's time for a full backup.
   * Pure decision helper; last-run bookkeeping lives in the orchestrator.
   */
  shouldRunFullBackup(lastRunTime: number = 0, now: number = Date.now()): boolean {
    return isFullBackupDue(lastRunTime, this.config.fullBackupIntervalMs, now);
  }

  /**
   * Check if it's time for an incremental backup.
   * Pure decision helper; last-run bookkeeping lives in the orchestrator.
   */
  shouldRunIncrementalBackup(lastRunTime: number = 0, now: number = Date.now()): boolean {
    return isIncrementalBackupDue(lastRunTime, this.config.incrementalIntervalMs, now);
  }

  /**
   * Get next scheduled time for full backup (ms from now).
   */
  getNextFullBackupTime(lastRunTime: number = 0, now: number = Date.now()): number {
    return msUntilNextRun(lastRunTime, this.config.fullBackupIntervalMs, now);
  }

  /**
   * Get next scheduled time for incremental backup (ms from now).
   */
  getNextIncrementalBackupTime(lastRunTime: number = 0, now: number = Date.now()): number {
    return msUntilNextRun(lastRunTime, this.config.incrementalIntervalMs, now);
  }

  /**
   * Trigger a manual backup outside the schedule.
   * Returns the queued job. Last-run bookkeeping is owned by the orchestrator.
   */
  async triggerManual(type: 'full' | 'incremental'): Promise<BackupJob> {
    if (type === 'full') return this.runFull();
    return this.runIncremental();
  }

  /**
   * Internal: Execute full backup.
   */
  private async runFull(): Promise<BackupJob> {
    logger.info('[BackupScheduler] Starting full backup');
    const job = await this.service.createBackup('full');
    logger.info('[BackupScheduler] Full backup queued:', job.id);
    return job;
  }

  /**
   * Internal: Execute incremental backup.
   */
  private async runIncremental(): Promise<BackupJob> {
    const base = this.service.getLatestCompleted('full');
    const baseId = base?.id;
    logger.info('[BackupScheduler] Starting incremental backup, base:', baseId ?? 'none');
    const job = await this.service.createBackup('incremental', baseId);
    logger.info('[BackupScheduler] Incremental backup queued:', job.id);
    return job;
  }
}
