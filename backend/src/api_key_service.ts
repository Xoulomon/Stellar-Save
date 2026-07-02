import { prisma } from './prisma_client';
import { logger } from './logger';
import crypto from 'crypto';

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

export class ApiKeyService {
  async generateKey(userId: string, name: string, tier: 'free' | 'pro' = 'free'): Promise<{ key: string; info: ApiKeyInfo }> {
    const keyId = crypto.randomBytes(16).toString('hex');
    const fullKey = `${API_KEY_PREFIX}${keyId}`;
    const keyHash = crypto.createHash(KEY_HASH_ALGORITHM).update(fullKey).digest('hex');
    const keyPrefix = fullKey.substring(0, 15) + '...';

    const rateLimits: Record<string, number> = { free: 100, pro: 1000, enterprise: 10000 };

    const apiKey = await (prisma as any).apiKey.create({
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

    logger.info('API key generated', { userId, tier });
    return { key: fullKey, info: apiKey as any };
  }

  async validateKey(key: string): Promise<{ valid: boolean; keyId?: string; userId?: string; rateLimit?: number }> {
    const keyHash = crypto.createHash(KEY_HASH_ALGORITHM).update(key).digest('hex');

    const apiKey = await (prisma as any).apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKey || !apiKey.isActive) {
      return { valid: false };
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false };
    }

    await (prisma as any).apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { valid: true, keyId: apiKey.id, userId: apiKey.userId, rateLimit: apiKey.rateLimit };
  }

  async getKeysForUser(userId: string): Promise<ApiKeyInfo[]> {
    return (prisma as any).apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeKey(keyId: string): Promise<void> {
    await (prisma as any).apiKey.update({
      where: { id: keyId },
      data: { isActive: false },
    });
    logger.info('API key revoked', { keyId });
  }

  async recordUsage(keyId: string, endpoint: string, method: string, statusCode: number): Promise<void> {
    await (prisma as any).apiKeyUsage.create({
      data: { keyId, endpoint, method, statusCode },
    });
  }

  async getUsageStats(keyId: string, hoursBack = 24): Promise<any> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const usage = await (prisma as any).apiKeyUsage.groupBy({
      by: ['method', 'statusCode'],
      where: { keyId, createdAt: { gte: since } },
      _count: { id: true },
    });

    return {
      keyId,
      period: { hours: hoursBack, since },
      requestsByMethod: usage.reduce((acc: any, u: any) => {
        acc[u.method] = (acc[u.method] || 0) + u._count.id;
        return acc;
      }, {}),
      totalRequests: usage.reduce((s: number, u: any) => s + u._count.id, 0),
    };
  }
}

export const apiKeyService = new ApiKeyService();
