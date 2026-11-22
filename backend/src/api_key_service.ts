import crypto from 'crypto';

import { logger } from './logger';
import { prisma } from './prisma_client';

const API_KEY_PREFIX = 'ss_';
const KEY_HASH_ALGORITHM = 'sha256';

export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  userId: string;
  name: string;
  tier: 'free' | 'pro' | 'enterprise';
  rateLimit: number;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- apiKey/apiKeyUsage are pending Prisma migration models; not yet in generated client
type ApiKeyDb = any;

/**
 * API Key Service
 *
 * Refactored for dependency injection (Issue #1701):
 * - DB client and logger are accepted via constructor
 */
export interface ApiKeyServiceDeps {
  db?: ApiKeyDb;
  logger?: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void; warn: (...a: unknown[]) => void };
}

export class ApiKeyService {
  private readonly db: ApiKeyDb;
  private readonly log: NonNullable<ApiKeyServiceDeps['logger']>;

  constructor(deps?: ApiKeyServiceDeps) {
    this.db = deps?.db ?? (prisma as ApiKeyDb);
    this.log = deps?.logger ?? logger;
  }

  async generateKey(
    userId: string,
    name: string,
    tier: 'free' | 'pro' = 'free'
  ): Promise<{ key: string; info: ApiKeyInfo }> {
    const keyId = crypto.randomBytes(16).toString('hex');
    const fullKey = `${API_KEY_PREFIX}${keyId}`;
    const keyHash = crypto.createHash(KEY_HASH_ALGORITHM).update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 15) + '...';

    const rateLimits: Record<string, number> = { free: 100, pro: 1000, enterprise: 10000 };

    const apiKey: ApiKeyInfo = await this.db.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        userId,
        name,
        tier,
        rateLimit: rateLimits[tier],
        isActive: true,
      },
    });

    this.log.info('API key generated', { userId, tier });
    return { key: fullKey, info: apiKey };
  }

  async validateKey(
    key: string
  ): Promise<{ valid: boolean; keyId?: string; userId?: string; rateLimit?: number }> {
    const keyHash = crypto.createHash(KEY_HASH_ALGORITHM).update(key).digest('hex');

    const apiKey: ApiKeyInfo & { expiresAt?: Date } = await this.db.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey || !apiKey.isActive) {
      return { valid: false };
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false };
    }

    await this.db.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { valid: true, keyId: apiKey.id, userId: apiKey.userId, rateLimit: apiKey.rateLimit };
  }

  async getKeysForUser(userId: string): Promise<ApiKeyInfo[]> {
    return this.db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(keyId: string): Promise<void> {
    await this.db.apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
    this.log.info('API key revoked', { keyId });
  }

  async recordUsage(
    keyId: string,
    endpoint: string,
    method: string,
    statusCode: number
  ): Promise<void> {
    await this.db.apiKeyUsage.create({
      data: { keyId, endpoint, method, statusCode },
    });
  }

  async getUsageStats(
    keyId: string,
    hoursBack = 24
  ): Promise<{
    keyId: string;
    period: { hours: number; since: Date };
    requestsByMethod: Record<string, number>;
    totalRequests: number;
  }> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const usage: Array<{ method: string; statusCode: number; _count: { id: number } }> =
      await this.db.apiKeyUsage.groupBy({
        by: ['method', 'statusCode'],
        where: { keyId, createdAt: { gte: since } },
        _count: { id: true },
      });

    return {
      keyId,
      period: { hours: hoursBack, since },
      requestsByMethod: usage.reduce<Record<string, number>>((acc, u) => {
        acc[u.method] = (acc[u.method] ?? 0) + u._count.id;
        return acc;
      }, {}),
      totalRequests: usage.reduce((s, u) => s + u._count.id, 0),
    };
  }
}

export const apiKeyService = new ApiKeyService();
