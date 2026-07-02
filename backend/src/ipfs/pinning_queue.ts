import { v4 as uuid } from 'uuid';
import redis from '../redis';
import { config } from '../config';
import { logger } from '../logger';

export type PinningJobStatus = 'queued' | 'pinning' | 'pinned' | 'failed' | 'unpinning' | 'unpinned';

export interface PinningJob {
  id: string;
  cid: string;
  groupId: string;
  contractId: string;
  action: 'pin' | 'unpin';
  status: PinningJobStatus;
  priority: number;
  retries: number;
  maxRetries: number;
  error?: string;
  createdAt: number;
  updatedAt: number;
  pinnedAt?: number;
}

const QUEUE_KEY = 'ipfs:pinning:queue';
const JOB_KEY_PREFIX = 'ipfs:pinning:job';
const PROCESSING_KEY = 'ipfs:pinning:processing';

export class PinningQueue {
  static async enqueue(
    cid: string,
    groupId: string,
    contractId: string,
    action: 'pin' | 'unpin',
    priority = 0,
  ): Promise<PinningJob> {
    const job: PinningJob = {
      id: uuid(),
      cid,
      groupId,
      contractId,
      action,
      status: 'queued',
      priority,
      retries: 0,
      maxRetries: config.ipfs.pinRetryCount,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await redis
      .multi()
      .hset(`${JOB_KEY_PREFIX}:${job.id}`, jobToMap(job))
      .zadd(QUEUE_KEY, priority, job.id)
      .exec();

    logger.info('IPFS pinning job enqueued', {
      jobId: job.id,
      cid,
      groupId,
      action,
    });

    return job;
  }

  static async dequeue(): Promise<PinningJob | null> {
    const result = await redis.zpopmin(QUEUE_KEY, 1);
    if (!result || result.length === 0) return null;

    const jobId = result[0];
    const jobData = await redis.hgetall(`${JOB_KEY_PREFIX}:${jobId}`);
    if (!jobData || Object.keys(jobData).length === 0) return null;

    const job = mapToJob(jobData as Record<string, string>);
    job.status = 'pinning';
    job.updatedAt = Date.now();

    await redis
      .multi()
      .hset(`${JOB_KEY_PREFIX}:${jobId}`, jobToMap(job))
      .sadd(PROCESSING_KEY, jobId)
      .exec();

    return job;
  }

  static async updateStatus(
    jobId: string,
    status: PinningJobStatus,
    error?: string,
  ): Promise<void> {
    const jobData = await redis.hgetall(`${JOB_KEY_PREFIX}:${jobId}`);
    if (!jobData || Object.keys(jobData).length === 0) return;

    const job = mapToJob(jobData as Record<string, string>);
    job.status = status;
    job.updatedAt = Date.now();
    if (error) job.error = error;
    if (status === 'pinned') job.pinnedAt = Date.now();
    if (status === 'failed') job.retries = (job.retries ?? 0) + 1;

    const multi = redis.multi().hset(`${JOB_KEY_PREFIX}:${jobId}`, jobToMap(job));

    if (['pinned', 'unpinned', 'failed'].includes(status)) {
      multi.srem(PROCESSING_KEY, jobId);
    }

    await multi.exec();
  }

  static async getJob(jobId: string): Promise<PinningJob | null> {
    const data = await redis.hgetall(`${JOB_KEY_PREFIX}:${jobId}`);
    if (!data || Object.keys(data).length === 0) return null;
    return mapToJob(data as Record<string, string>);
  }

  static async getJobsByGroup(groupId: string): Promise<PinningJob[]> {
    const keys = await redis.keys(`${JOB_KEY_PREFIX}:*`);
    const jobs: PinningJob[] = [];

    for (const key of keys) {
      const data = await redis.hgetall(key);
      if (data && (data as Record<string, string>).groupId === groupId) {
        jobs.push(mapToJob(data as Record<string, string>));
      }
    }

    return jobs.sort((a, b) => b.createdAt - a.createdAt);
  }

  static async getQueueStats(): Promise<{
    queued: number;
    processing: number;
    pinned: number;
    failed: number;
  }> {
    const [queuedCount, processingCount] = await Promise.all([
      redis.zcard(QUEUE_KEY),
      redis.scard(PROCESSING_KEY),
    ]);

    const allKeys = await redis.keys(`${JOB_KEY_PREFIX}:*`);
    let pinned = 0;
    let failed = 0;

    for (const key of allKeys) {
      const status = await redis.hget(key, 'status');
      if (status === 'pinned') pinned++;
      if (status === 'failed') failed++;
    }

    return {
      queued: queuedCount,
      processing: processingCount,
      pinned,
      failed,
    };
  }

  static async retryFailed(cid: string): Promise<PinningJob | null> {
    const keys = await redis.keys(`${JOB_KEY_PREFIX}:*`);
    for (const key of keys) {
      const data = await redis.hgetall(key);
      const job = data as Record<string, string>;
      if (job.cid === cid && job.status === 'failed') {
        job.status = 'queued';
        job.retries = '0';
        job.error = '';
        job.updatedAt = String(Date.now());
        await redis
          .multi()
          .hset(key, job)
          .zadd(QUEUE_KEY, parseInt(job.priority ?? '0', 10), job.id)
          .exec();
        return mapToJob(job);
      }
    }
    return null;
  }
}

function jobToMap(job: PinningJob): Record<string, string> {
  return {
    id: job.id,
    cid: job.cid,
    groupId: job.groupId,
    contractId: job.contractId,
    action: job.action,
    status: job.status,
    priority: String(job.priority),
    retries: String(job.retries),
    maxRetries: String(job.maxRetries),
    error: job.error ?? '',
    createdAt: String(job.createdAt),
    updatedAt: String(job.updatedAt),
    pinnedAt: job.pinnedAt ? String(job.pinnedAt) : '',
  };
}

function mapToJob(data: Record<string, string>): PinningJob {
  return {
    id: data.id,
    cid: data.cid,
    groupId: data.groupId,
    contractId: data.contractId,
    action: data.action as 'pin' | 'unpin',
    status: data.status as PinningJobStatus,
    priority: parseInt(data.priority ?? '0', 10),
    retries: parseInt(data.retries ?? '0', 10),
    maxRetries: parseInt(data.maxRetries ?? '3', 10),
    error: data.error || undefined,
    createdAt: parseInt(data.createdAt ?? '0', 10),
    updatedAt: parseInt(data.updatedAt ?? '0', 10),
    pinnedAt: data.pinnedAt ? parseInt(data.pinnedAt, 10) : undefined,
  };
}
