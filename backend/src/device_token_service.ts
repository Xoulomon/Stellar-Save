import { logger } from './logger';
import { prisma } from './prisma_client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mobileDeviceToken model is pending Prisma migration; not yet in generated client
type DbClient = any;

/**
 * Device token service for managing push notification device registrations.
 *
 * Refactored for dependency injection (Issue #1701):
 * - DB client and logger are accepted via constructor
 * - Tests can inject in-memory stubs instead of the real Prisma client
 */

export interface DeviceTokenServiceDeps {
  db?: DbClient;
  logger?: { info: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
}

export class DeviceTokenService {
  private readonly db: DbClient;
  private readonly log: NonNullable<DeviceTokenServiceDeps['logger']>;

  constructor(deps?: DeviceTokenServiceDeps) {
    this.db = deps?.db ?? prisma;
    this.log = deps?.logger ?? logger;
  }

  async registerToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    await this.db.mobileDeviceToken.upsert({
      where: { token },
      update: { userId, platform, isValid: true, lastUsedAt: new Date() },
      create: { userId, token, platform },
    });
    this.log.info('Mobile device token registered', { userId, platform });
  }

  async removeToken(token: string): Promise<void> {
    await this.db.mobileDeviceToken.updateMany({
      where: { token },
      data: { isValid: false },
    });
    this.log.info('Mobile device token removed', { token: token.substring(0, 8) + '...' });
  }

  async getTokensForUser(userId: string): Promise<Array<{ token: string; platform: string }>> {
    return this.db.mobileDeviceToken.findMany({
      where: { userId, isValid: true },
      select: { token: true, platform: true },
    });
  }

  async markTokenInvalid(token: string): Promise<void> {
    await this.db.mobileDeviceToken.updateMany({
      where: { token },
      data: { isValid: false },
    });
  }

  async pruneExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const result: { count: number } = await this.db.mobileDeviceToken.deleteMany({
      where: { OR: [{ isValid: false }, { createdAt: { lt: cutoff } }] },
    });
    this.log.info('Pruned expired mobile tokens', { count: result.count });
  }
}

/** Default singleton — uses production deps. */
export const deviceTokenService = new DeviceTokenService();
