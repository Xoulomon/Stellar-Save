import { IpfsClient } from './client';
import { PinningService } from './pinning_service';
import { PinningQueue } from './pinning_queue';
import redis from '../redis';
import { logger } from '../logger';

const METADATA_CID_PREFIX = 'ipfs:group:cid';
const METADATA_CACHE_PREFIX = 'ipfs:group:cache';
const METADATA_CACHE_TTL = 300;

export interface GroupMetadata {
  name?: string;
  description?: string;
  image_url?: string;
  updated_at?: number;
  updated_by?: string;
  version?: number;
}

export class GroupMetadataCache {
  private ipfs: IpfsClient;
  private pinning: PinningService;

  constructor(ipfs?: IpfsClient, pinning?: PinningService) {
    this.ipfs = ipfs ?? new IpfsClient();
    this.pinning = pinning ?? new PinningService(this.ipfs);
  }

  async cacheMetadata(
    groupId: string,
    contractId: string,
    metadata: GroupMetadata,
  ): Promise<string> {
    const payload = {
      ...metadata,
      updated_at: metadata.updated_at ?? Math.floor(Date.now() / 1000),
      version: metadata.version ?? 1,
    };

    const payloadJson = JSON.stringify(payload);
    const result = await this.ipfs.add(payloadJson, `group-${groupId}-metadata.json`);

    await redis.set(`${METADATA_CID_PREFIX}:${contractId}:${groupId}`, result.cid);
    await redis.setex(
      `${METADATA_CACHE_PREFIX}:${contractId}:${groupId}`,
      METADATA_CACHE_TTL,
      payloadJson,
    );

    await this.pinning.pinContent(result.cid, groupId, contractId, 0);

    logger.info('Group metadata cached to IPFS', {
      groupId,
      contractId,
      cid: result.cid,
      size: result.size,
    });

    return result.cid;
  }

  async getCachedMetadata(
    groupId: string,
    contractId: string,
  ): Promise<{ metadata: GroupMetadata | null; cid: string | null }> {
    const cached = await redis.get(`${METADATA_CACHE_PREFIX}:${contractId}:${groupId}`);
    if (cached) {
      const cid = await redis.get(`${METADATA_CID_PREFIX}:${contractId}:${groupId}`);
      return { metadata: JSON.parse(cached as string) as GroupMetadata, cid };
    }

    const cid = await redis.get(`${METADATA_CID_PREFIX}:${contractId}:${groupId}`);
    if (!cid) return { metadata: null, cid: null };

    try {
      const raw = await this.ipfs.cat(cid);
      const metadata = JSON.parse(raw) as GroupMetadata;
      await redis.setex(
        `${METADATA_CACHE_PREFIX}:${contractId}:${groupId}`,
        METADATA_CACHE_TTL,
        raw,
      );
      await this.pinning.recordAccess(cid);
      return { metadata, cid };
    } catch (err) {
      logger.error('Failed to fetch group metadata from IPFS', {
        groupId,
        contractId,
        cid,
        error: String(err),
      });
      return { metadata: null, cid };
    }
  }

  async invalidateMetadata(groupId: string, contractId: string): Promise<void> {
    const cid = await redis.get(`${METADATA_CID_PREFIX}:${contractId}:${groupId}`);
    await redis.del(`${METADATA_CACHE_PREFIX}:${contractId}:${groupId}`);

    if (cid) {
      await this.pinning.unpinContent(cid as string, groupId, contractId);
      await redis.del(`${METADATA_CID_PREFIX}:${contractId}:${groupId}`);
    }

    logger.info('Group metadata cache invalidated', { groupId, contractId });
  }

  async getCid(groupId: string, contractId: string): Promise<string | null> {
    const cid = await redis.get(`${METADATA_CID_PREFIX}:${contractId}:${groupId}`);
    return cid as string | null;
  }

  async getPinStatus(groupId: string, contractId: string): Promise<{
    cid: string | null;
    pinned: boolean;
    accessCount: number;
    jobCount: number;
  }> {
    const cid = await this.getCid(groupId, contractId);
    if (!cid) {
      return { cid: null, pinned: false, accessCount: 0, jobCount: 0 };
    }

    const [pinned, accessCount, jobs] = await Promise.all([
      this.pinning.isPinned(cid),
      this.pinning.getAccessCount(cid),
      PinningQueue.getJobsByGroup(groupId),
    ]);

    return { cid, pinned, accessCount, jobCount: jobs.length };
  }

  async refreshAllPins(contractId: string): Promise<{ refreshed: number; failed: number }> {
    const keys = await redis.keys(`${METADATA_CID_PREFIX}:${contractId}:*`);
    let refreshed = 0;
    let failed = 0;

    for (const key of keys) {
      const groupId = key.replace(`${METADATA_CID_PREFIX}:${contractId}:`, '');
      const cid = await redis.get(key);
      if (cid) {
        try {
          await this.pinning.refreshPin(cid as string, groupId, contractId);
          refreshed++;
        } catch {
          failed++;
        }
      }
    }

    return { refreshed, failed };
  }
}
