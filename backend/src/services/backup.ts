import crypto from 'crypto';
import { spawn } from 'child_process';
import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

export interface BackupResult {
  key: string;
  sizeBytes: number;
  timestamp: Date;
  checksum: string;
}

// Compact, S3-safe timestamp: 20240115T120000Z
function formatTimestamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
}

// Inverse of formatTimestamp
function parseTimestamp(s: string): Date | null {
  // Input like 20240115T120000Z → 2024-01-15T12:00:00Z
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
  return isNaN(d.getTime()) ? null : d;
}

export class BackupService {
  private s3: S3Client;
  private bucket: string;
  private retentionDays: number;

  constructor(s3Client?: S3Client) {
    this.s3 =
      s3Client ??
      new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
        },
      });
    this.bucket = process.env.BACKUP_S3_BUCKET || 'stellar-save-backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  }

  /**
   * Run pg_dump, compress the output, upload to S3 with a timestamped key,
   * and return metadata about the backup.
   */
  async runBackup(): Promise<BackupResult> {
    console.log('[BackupService] Running pg_dump...');
    const data = await this.pgDump();
    const timestamp = new Date();
    const key = `backups/stellar-save-${formatTimestamp(timestamp)}.dump`;

    await this.uploadToS3(data, key);

    const checksum = crypto.createHash('sha256').update(data).digest('hex');
    console.log(
      `[BackupService] Backup complete — s3://${this.bucket}/${key} (${data.length} bytes)`
    );
    return { key, sizeBytes: data.length, timestamp, checksum };
  }

  /**
   * Delete backups in S3 older than retentionDays.
   * Returns the number of objects deleted.
   */
  async applyRetentionPolicy(): Promise<number> {
    const cutoff = Date.now() - this.retentionDays * 86_400_000;
    const keys = await this.listBackupKeys();
    let deleted = 0;

    for (const key of keys) {
      const ts = this.parseKeyTimestamp(key);
      if (ts && ts.getTime() < cutoff) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
        console.log(`[BackupService] Deleted expired backup: ${key}`);
        deleted++;
      }
    }

    if (deleted > 0) {
      console.log(
        `[BackupService] Retention policy applied — deleted ${deleted} backup(s) older than ${this.retentionDays} days`
      );
    }
    return deleted;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Spawn pg_dump and capture stdout as a Buffer.
   * Uses --format=custom which applies Lempel-Ziv compression internally.
   * Accepts the DATABASE_URL connection string directly so no separate
   * host/user/password env vars are required.
   */
  private pgDump(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const databaseUrl = process.env.DATABASE_URL;
      if (!databaseUrl) {
        return reject(new Error('DATABASE_URL is not set'));
      }

      const chunks: Buffer[] = [];

      const child = spawn(
        'pg_dump',
        [
          '--format=custom', // binary + built-in LZ compression
          '--compress=9',    // maximum compression level
          '--no-password',   // credentials come from the connection string
          databaseUrl,
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));

      child.stderr.on('data', (chunk: Buffer) => {
        const msg = chunk.toString().trim();
        // pg_dump writes progress notices to stderr; only log real errors
        if (msg && !msg.startsWith('pg_dump: last built-in')) {
          console.error('[pg_dump stderr]', msg);
        }
      });

      child.on('close', code => {
        if (code === 0) {
          resolve(Buffer.concat(chunks));
        } else {
          reject(new Error(`pg_dump exited with non-zero code ${code}`));
        }
      });

      child.on('error', err => {
        reject(new Error(`Failed to spawn pg_dump: ${err.message}`));
      });
    });
  }

  private async uploadToS3(data: Buffer, key: string): Promise<void> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: 'application/octet-stream',
      })
    );
  }

  private async listBackupKeys(): Promise<string[]> {
    const res = await this.s3.send(
      new ListObjectsV2Command({ Bucket: this.bucket, Prefix: 'backups/' })
    );
    return (res.Contents ?? [])
      .map(obj => obj.Key)
      .filter((k): k is string => typeof k === 'string');
  }

  /** Extract the timestamp embedded in a backup key. Returns null for unrecognised keys. */
  private parseKeyTimestamp(key: string): Date | null {
    const match = key.match(/stellar-save-([0-9T]+Z)\.dump$/);
    return match ? parseTimestamp(match[1]) : null;
  }
}
