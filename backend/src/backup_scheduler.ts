import { BackupService } from './backup_service';
import { BackupJob } from './models';

export interface SchedulerConfig {
  fullBackupIntervalMs: number;    // default: 24h
  incrementalIntervalMs: number;   // default: 6h
}

const DEFAULT_CONFIG: SchedulerConfig = {
  fullBackupIntervalMs: 24 * 60 * 60 * 1000,
  incrementalIntervalMs: 6 * 60 * 60 * 1000,
};

export class BackupScheduler {
  private config: SchedulerConfig;
  private service: BackupService;
  private fullTimer: ReturnType<typeof setInterval> | null = null;
  private incrementalTimer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(service: BackupService, config: Partial<SchedulerConfig> = {}) {
    this.service = service;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  start(): void {
    if (this.running) return;
    this.running = true;

    // Run immediately on start, then on interval
    this.runFull();
    this.fullTimer = setInterval(() => this.runFull(), this.config.fullBackupIntervalMs);
    this.incrementalTimer = setInterval(() => this.runIncremental(), this.config.incrementalIntervalMs);

    console.log('[BackupScheduler] Started — full every', this.config.fullBackupIntervalMs / 3600000, 'h, incremental every', this.config.incrementalIntervalMs / 3600000, 'h');
  }

  stop(): void {
    if (this.fullTimer) clearInterval(this.fullTimer);
    if (this.incrementalTimer) clearInterval(this.incrementalTimer);
    this.fullTimer = null;
    this.incrementalTimer = null;
    this.running = false;
    console.log('[BackupScheduler] Stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async runFull(): Promise<BackupJob> {
    console.log('[BackupScheduler] Starting full backup');
    const job = await this.service.createBackup('full');
    console.log('[BackupScheduler] Full backup queued:', job.id);
    return job;
  }

  private async runIncremental(): Promise<BackupJob> {
    const base = this.service.getLatestCompleted('full');
    const baseId = base?.id;
    console.log('[BackupScheduler] Starting incremental backup, base:', baseId ?? 'none');
    const job = await this.service.createBackup('incremental', baseId);
    console.log('[BackupScheduler] Incremental backup queued:', job.id);
    return job;
  }

  /** Trigger a manual backup outside the schedule */
  async triggerManual(type: 'full' | 'incremental'): Promise<BackupJob> {
    if (type === 'full') return this.runFull();
    return this.runIncremental();
  }
}
