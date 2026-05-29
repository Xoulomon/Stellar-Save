import crypto from 'crypto';
import { BackupJob, BackupType, BackupStatus } from './models';

export interface S3Client {
  putObject(params: { Bucket: string; Key: string; Body: Buffer; ContentType: string }): Promise<void>;
  getObject(params: { Bucket: string; Key: string }): Promise<Buffer>;
  listObjects(params: { Bucket: string; Prefix: string }): Promise<string[]>;
  deleteObject(params: { Bucket: string; Key: string }): Promise<void>;
}

// Lightweight S3 client using fetch (avoids heavy SDK dependency)
export class S3HttpClient implements S3Client {
  private region: string;
  private bucket: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.BACKUP_S3_BUCKET || '';
    this.accessKeyId = process.env.AWS_ACCESS_KEY_ID || '';
    this.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || '';
  }

  private sign(method: string, key: string, body: Buffer, contentType: string): Record<string, string> {
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateShort = date.slice(0, 8);
    const host = `${this.bucket}.s3.${this.region}.amazonaws.com`;
    const payloadHash = crypto.createHash('sha256').update(body).digest('hex');
    const canonicalHeaders = `content-type:${contentType}\nhost:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${date}\n`;
    const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = [method, `/${key}`, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
    const credentialScope = `${dateShort}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', date, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const hmac = (key: Buffer, data: string) => crypto.createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${this.secretAccessKey}`), dateShort), this.region), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    return {
      Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
    };
  }

  async putObject({ Bucket, Key, Body, ContentType }: { Bucket: string; Key: string; Body: Buffer; ContentType: string }): Promise<void> {
    const url = `https://${Bucket}.s3.${this.region}.amazonaws.com/${Key}`;
    const headers = this.sign('PUT', Key, Body, ContentType);
    const res = await fetch(url, { method: 'PUT', headers, body: Body });
    if (!res.ok) throw new Error(`S3 putObject failed: ${res.status} ${await res.text()}`);
  }

  async getObject({ Bucket, Key }: { Bucket: string; Key: string }): Promise<Buffer> {
    const emptyHash = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateShort = date.slice(0, 8);
    const host = `${Bucket}.s3.${this.region}.amazonaws.com`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${date}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = ['GET', `/${Key}`, '', canonicalHeaders, signedHeaders, emptyHash].join('\n');
    const credentialScope = `${dateShort}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', date, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const hmac = (key: Buffer, data: string) => crypto.createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${this.secretAccessKey}`), dateShort), this.region), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const url = `https://${host}/${Key}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': emptyHash,
        'x-amz-date': date,
      },
    });
    if (!res.ok) throw new Error(`S3 getObject failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async listObjects({ Bucket, Prefix }: { Bucket: string; Prefix: string }): Promise<string[]> {
    const emptyHash = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateShort = date.slice(0, 8);
    const host = `${Bucket}.s3.${this.region}.amazonaws.com`;
    const query = `list-type=2&prefix=${encodeURIComponent(Prefix)}`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${date}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = ['GET', '/', query, canonicalHeaders, signedHeaders, emptyHash].join('\n');
    const credentialScope = `${dateShort}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', date, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const hmac = (key: Buffer, data: string) => crypto.createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${this.secretAccessKey}`), dateShort), this.region), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const url = `https://${host}/?${query}`;
    const res = await fetch(url, {
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': emptyHash,
        'x-amz-date': date,
      },
    });
    if (!res.ok) throw new Error(`S3 listObjects failed: ${res.status}`);
    const xml = await res.text();
    const keys: string[] = [];
    const re = /<Key>([^<]+)<\/Key>/g;
    let m;
    while ((m = re.exec(xml)) !== null) keys.push(m[1]);
    return keys;
  }

  async deleteObject({ Bucket, Key }: { Bucket: string; Key: string }): Promise<void> {
    const emptyHash = crypto.createHash('sha256').update(Buffer.alloc(0)).digest('hex');
    const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '').slice(0, 15) + 'Z';
    const dateShort = date.slice(0, 8);
    const host = `${Bucket}.s3.${this.region}.amazonaws.com`;
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${emptyHash}\nx-amz-date:${date}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    const canonicalRequest = ['DELETE', `/${Key}`, '', canonicalHeaders, signedHeaders, emptyHash].join('\n');
    const credentialScope = `${dateShort}/${this.region}/s3/aws4_request`;
    const stringToSign = ['AWS4-HMAC-SHA256', date, credentialScope, crypto.createHash('sha256').update(canonicalRequest).digest('hex')].join('\n');
    const hmac = (key: Buffer, data: string) => crypto.createHmac('sha256', key).update(data).digest();
    const signingKey = hmac(hmac(hmac(hmac(Buffer.from(`AWS4${this.secretAccessKey}`), dateShort), this.region), 's3'), 'aws4_request');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');
    const url = `https://${host}/${Key}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
        'x-amz-content-sha256': emptyHash,
        'x-amz-date': date,
      },
    });
    if (!res.ok && res.status !== 204) throw new Error(`S3 deleteObject failed: ${res.status}`);
  }
}

export class BackupService {
  private jobs = new Map<string, BackupJob>();
  private s3: S3Client;
  private bucket: string;
  private retentionDays: number;

  constructor(s3Client?: S3Client) {
    this.s3 = s3Client ?? new S3HttpClient();
    this.bucket = process.env.BACKUP_S3_BUCKET || 'stellar-save-backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10);
  }

  /** Collect all application data to back up */
  private collectData(type: BackupType, baseBackupId?: string): Record<string, unknown> {
    return {
      type,
      baseBackupId: baseBackupId ?? null,
      timestamp: Date.now(),
      // In production, replace with real DB/store queries
      data: { groups: [], members: [], transactions: [], preferences: [] },
    };
  }

  /** Compute incremental diff against a base snapshot */
  private computeIncremental(current: Record<string, unknown>, _baseKey: string): Record<string, unknown> {
    // Simplified: in production, diff against the base backup fetched from S3
    return { ...current, type: 'incremental' };
  }

  async createBackup(type: BackupType, baseBackupId?: string): Promise<BackupJob> {
    const id = crypto.randomUUID();
    const job: BackupJob = { id, type, status: 'pending', createdAt: Date.now(), baseBackupId };
    this.jobs.set(id, job);

    // Run async
    this.runBackup(job).catch(() => {});
    return job;
  }

  private async runBackup(job: BackupJob): Promise<void> {
    job.status = 'running';
    try {
      let payload = this.collectData(job.type, job.baseBackupId);
      if (job.type === 'incremental' && job.baseBackupId) {
        const baseJob = this.jobs.get(job.baseBackupId);
        if (baseJob?.s3Key) {
          payload = this.computeIncremental(payload, baseJob.s3Key);
        }
      }

      const body = Buffer.from(JSON.stringify(payload));
      const checksum = crypto.createHash('sha256').update(body).digest('hex');
      const s3Key = `backups/${job.type}/${job.id}.json`;

      await this.s3.putObject({ Bucket: this.bucket, Key: s3Key, Body: body, ContentType: 'application/json' });

      job.status = 'completed';
      job.completedAt = Date.now();
      job.s3Key = s3Key;
      job.sizeBytes = body.length;
      job.checksum = checksum;
    } catch (err: unknown) {
      job.status = 'failed';
      job.error = err instanceof Error ? err.message : String(err);
    }
  }

  getJob(id: string): BackupJob | undefined {
    return this.jobs.get(id);
  }

  listJobs(): BackupJob[] {
    return Array.from(this.jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getLatestCompleted(type?: BackupType): BackupJob | undefined {
    return this.listJobs().find(j => j.status === 'completed' && (!type || j.type === type));
  }

  async pruneOldBackups(): Promise<number> {
    const cutoff = Date.now() - this.retentionDays * 86_400_000;
    const keys = await this.s3.listObjects({ Bucket: this.bucket, Prefix: 'backups/' });
    let pruned = 0;
    for (const key of keys) {
      // Key format: backups/<type>/<id>.json — find matching job
      const jobId = key.split('/').pop()?.replace('.json', '');
      const job = jobId ? this.jobs.get(jobId) : undefined;
      if (job && job.createdAt < cutoff) {
        await this.s3.deleteObject({ Bucket: this.bucket, Key: key });
        this.jobs.delete(job.id);
        pruned++;
      }
    }
    return pruned;
  }
}
