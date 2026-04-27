import crypto from 'crypto';
import { BackupService, S3Client } from './backup_service';
import { BackupJob } from './models';

export interface RecoveryResult {
  jobId: string;
  restoredAt: number;
  recordCount: number;
  checksum: string;
}

export class RecoveryService {
  private service: BackupService;
  private s3: S3Client;
  private bucket: string;

  constructor(service: BackupService, s3Client: S3Client) {
    this.service = service;
    this.s3 = s3Client;
    this.bucket = process.env.BACKUP_S3_BUCKET || 'stellar-save-backups';
  }

  /** Restore from a specific backup job */
  async restore(jobId: string): Promise<RecoveryResult> {
    const job = this.service.getJob(jobId);
    if (!job) throw new Error(`Backup job not found: ${jobId}`);
    if (job.status !== 'completed') throw new Error(`Backup job ${jobId} is not completed (status: ${job.status})`);
    if (!job.s3Key) throw new Error(`Backup job ${jobId} has no S3 key`);

    const body = await this.s3.getObject({ Bucket: this.bucket, Key: job.s3Key });

    // Verify checksum
    const actualChecksum = crypto.createHash('sha256').update(body).digest('hex');
    if (job.checksum && actualChecksum !== job.checksum) {
      throw new Error(`Checksum mismatch for backup ${jobId}: expected ${job.checksum}, got ${actualChecksum}`);
    }

    const payload = JSON.parse(body.toString('utf-8'));

    // For incremental backups, apply on top of the base full backup
    if (job.type === 'incremental' && job.baseBackupId) {
      await this.applyIncremental(job.baseBackupId, payload);
    } else {
      await this.applyFull(payload);
    }

    const recordCount = this.countRecords(payload);
    return { jobId, restoredAt: Date.now(), recordCount, checksum: actualChecksum };
  }

  /** Restore the latest completed backup */
  async restoreLatest(type?: 'full' | 'incremental'): Promise<RecoveryResult> {
    const job = this.service.getLatestCompleted(type);
    if (!job) throw new Error(`No completed ${type ?? ''} backup found`);
    return this.restore(job.id);
  }

  /** List available restore points */
  listRestorePoints(): BackupJob[] {
    return this.service.listJobs().filter(j => j.status === 'completed');
  }

  private async applyFull(payload: Record<string, unknown>): Promise<void> {
    // In production: write payload.data to the database/store
    console.log('[RecoveryService] Applying full restore, timestamp:', payload.timestamp);
  }

  private async applyIncremental(baseJobId: string, delta: Record<string, unknown>): Promise<void> {
    // First restore the base, then apply the delta
    await this.restore(baseJobId);
    console.log('[RecoveryService] Applying incremental delta on top of base:', baseJobId, 'timestamp:', delta.timestamp);
  }

  private countRecords(payload: Record<string, unknown>): number {
    const data = payload.data as Record<string, unknown[]> | undefined;
    if (!data) return 0;
    return Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  }
}
