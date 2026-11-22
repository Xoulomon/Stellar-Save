import crypto from 'crypto';

import { logger } from './logger';
import { prisma } from './prisma_client';

export const API_KEY_PREFIX = 'ss_';
export const KEY_HASH_ALGORITHM = 'sha256';

export type ApiKeyTier = 'free' | 'pro' | 'enterprise';

export interface ApiKeyInfo {
  id: string;
  keyPrefix: string;
  userId: string;
  name: string;
  tier: ApiKeyTier;
  rateLimit: number;
  isActive: boolean;
  lastUsedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export const DEFAULT_RATE_LIMITS: Record<ApiKeyTier, number> = {
  free: 100,
  pro: 1000,
  enterprise: 10000,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- apiKey/apiKeyUsage are pending Prisma migration models; not yet in generated client
type ApiKeyDb = any;

/**
 * Hash an API key using the canonical algorithm.
 */
export function hashApiKey(key: string): string {
  return crypto.createHash(KEY_HASH_ALGORITHM).update(key).digest('hex');
}

/**
 * Mask an API key for safe display/logging.
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  return key.length <= 15 ? `${key}...` : `${key.substring(0, 15)}...`;
}

/**
 * API Key Service
 *
 * Refactored for dependency injection and modularity (Issue #1701, #2114):
 * - DB client and logger are accepted via constructor
 * - Extracted hashing and masking utilities
 * - Added input validation and boundary protections
 */
export interface ApiKeyServiceDeps {
  db?: ApiKeyDb;
  logger?: {
    info: (...a: unknown[]) => void;
    error: (...a: unknown[]) => void;
    warn: (...a: unknown[]) => void;
  };
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
    tier: ApiKeyTier = 'free'
  ): Promise<{ key: string; info: ApiKeyInfo }> {
    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('name is required');
    }

    const keyId = crypto.randomBytes(16).toString('hex');
    const fullKey = `${API_KEY_PREFIX}${keyId}`;
    const keyHash = hashApiKey(fullKey);
    const keyPrefix = maskApiKey(fullKey);

    const rateLimit = DEFAULT_RATE_LIMITS[tier] ?? DEFAULT_RATE_LIMITS.free;

    const apiKey: ApiKeyInfo = await this.db.apiKey.create({
      data: {
        keyHash,
        keyPrefix,
        userId,
        name,
        tier,
        rateLimit,
        isActive: true,
      },
    });

    this.log.info('API key generated', { userId, tier });
    return { key: fullKey, info: apiKey };
  }

  async validateKey(
    key: string
  ): Promise<{ valid: boolean; keyId?: string; userId?: string; rateLimit?: number }> {
    if (!key || typeof key !== 'string' || !key.startsWith(API_KEY_PREFIX)) {
      return { valid: false };
    }

    const keyHash = hashApiKey(key);

    const apiKey: (ApiKeyInfo & { expiresAt?: Date }) | null = await this.db.apiKey.findUnique({
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
    if (!userId) return [];
    return this.db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(keyId: string): Promise<void> {
    if (!keyId) return;
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
