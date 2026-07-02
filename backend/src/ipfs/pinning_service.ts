import { IpfsClient } from './client';
import { PinningQueue, PinningJob } from './pinning_queue';
import redis from '../redis';
import { config } from '../config';
import { logger } from '../logger';

const ACCESS_COUNTER_PREFIX = 'ipfs:access:count';
const PINNED_CID_PREFIX = 'ipfs:pinned:cid';
const HOT_CID_PREFIX = 'ipfs:hot:cid';

export class PinningService {
  private ipfs: IpfsClient;
  private processorTimer: ReturnType<typeof setInterval> | null = null;
  private checkIntervalMs: number;

  constructor(ipfs?: IpfsClient) {
    this.ipfs = ipfs ?? new IpfsClient();
    this.checkIntervalMs = config.ipfs.pinCheckIntervalMs;
  }

  start(): void {
    if (this.processorTimer) return;
    this.processorTimer = setInterval(() => {
      this.processQueue().catch((err) => {
        logger.error('IPFS pinning queue processor error', { error: String(err) });
      });
    }, this.checkIntervalMs);
    logger.info('IPFS pinning service started', { checkIntervalMs: this.checkIntervalMs });
  }

  stop(): void {
    if (this.processorTimer) {
      clearInterval(this.processorTimer);
      this.processorTimer = null;
    }
    logger.info('IPFS pinning service stopped');
  }

  private async processQueue(): Promise<void> {
    const ipfsReady = await this.ipfs.healthCheck();
    if (!ipfsReady) {
      logger.warn('IPFS node not available, skipping queue processing');
      return;
    }

    const job = await PinningQueue.dequeue();
    if (!job) return;

    try {
      if (job.action === 'pin') {
        const result = await this.ipfs.pinAdd(job.cid);
        if (result.pinned) {
          await PinningQueue.updateStatus(job.id, 'pinned');
          await redis.set(`${PINNED_CID_PREFIX}:${job.cid}`, 'true');
          logger.info('Content pinned to IPFS', {
            jobId: job.id,
            cid: job.cid,
            groupId: job.groupId,
          });
        } else {
          throw new Error(`Pin add returned unexpected result for ${job.cid}`);
        }
      } else if (job.action === 'unpin') {
        await this.ipfs.pinRm(job.cid);
        await PinningQueue.updateStatus(job.id, 'unpinned');
        await redis.del(`${PINNED_CID_PREFIX}:${job.cid}`);
        await redis.del(`${HOT_CID_PREFIX}:${job.cid}`);
        logger.info('Content unpinned from IPFS', {
          jobId: job.id,
          cid: job.cid,
          groupId: job.groupId,
        });
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('IPFS pinning job failed', {
        jobId: job.id,
        cid: job.cid,
        action: job.action,
        error: errorMsg,
      });

      await PinningQueue.updateStatus(job.id, 'failed', errorMsg);

      if (job.retries < job.maxRetries) {
        const backoffMs = Math.min(1000 * Math.pow(2, job.retries), 60000);
        setTimeout(async () => {
          const retryJob = await PinningQueue.getJob(job.id);
          if (retryJob && retryJob.status === 'failed') {
            await PinningQueue.retryFailed(job.cid);
          }
        }, backoffMs);
      }
    }
  }

  async pinContent(
    cid: string,
    groupId: string,
    contractId: string,
    priority = 0,
  ): Promise<PinningJob> {
    const alreadyPinned = await redis.get(`${PINNED_CID_PREFIX}:${cid}`);
    if (alreadyPinned === 'true') {
      logger.debug('Content already pinned, skipping', { cid, groupId });
      const existing = await PinningQueue.getJobsByGroup(groupId);
      return existing.find((j) => j.cid === cid && j.status === 'pinned')!;
    }

    return PinningQueue.enqueue(cid, groupId, contractId, 'pin', priority);
  }

  async unpinContent(cid: string, groupId: string, contractId: string): Promise<PinningJob> {
    return PinningQueue.enqueue(cid, groupId, contractId, 'unpin');
  }

  async recordAccess(cid: string): Promise<void> {
    const key = `${ACCESS_COUNTER_PREFIX}:${cid}`;
    const count = await redis.incr(key);
    await redis.expire(key, 86400);
  }

  async getAccessCount(cid: string): Promise<number> {
    const count = await redis.get(`${ACCESS_COUNTER_PREFIX}:${cid}`);
    return count ? parseInt(count as string, 10) : 0;
  }

  async markHot(cid: string): Promise<void> {
    await redis.set(`${HOT_CID_PREFIX}:${cid}`, 'true');
    await redis.expire(`${HOT_CID_PREFIX}:${cid}`, 86400);
  }

  async isHot(cid: string): Promise<boolean> {
    const val = await redis.get(`${HOT_CID_PREFIX}:${cid}`);
    return val === 'true';
  }

  async isPinned(cid: string): Promise<boolean> {
    const val = await redis.get(`${PINNED_CID_PREFIX}:${cid}`);
    if (val === 'true') return true;
    const pins = await this.ipfs.pinLs(cid);
    return pins.length > 0;
  }

  async refreshPin(cid: string, groupId: string, contractId: string): Promise<void> {
    const pinned = await this.isPinned(cid);
    if (!pinned) {
      await this.pinContent(cid, groupId, contractId, 1);
    }
  }

  async verifyAllPins(): Promise<{ total: number; pinned: number; missing: number; failed: number }> {
    const keys = await redis.keys(`${PINNED_CID_PREFIX}:*`);
    let pinned = 0;
    let missing = 0;

    for (const key of keys) {
      const cid = key.replace(`${PINNED_CID_PREFIX}:`, '');
      try {
        const pins = await this.ipfs.pinLs(cid);
        if (pins.length > 0) {
          pinned++;
        } else {
          missing++;
          await redis.del(key);
          logger.warn('Previously pinned CID no longer found on IPFS node', { cid });
        }
      } catch {
        missing++;
      }
    }

    return { total: keys.length, pinned, missing, failed: 0 };
  }
}
