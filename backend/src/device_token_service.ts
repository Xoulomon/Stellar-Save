import { prisma } from './prisma_client';
import { logger } from './logger';

export class DeviceTokenService {
  async registerToken(userId: string, token: string, platform: 'ios' | 'android'): Promise<void> {
    await (prisma as any).mobileDeviceToken.upsert({
      where: { token },
      update: { userId, platform, isValid: true, lastUsedAt: new Date() },
      create: { userId, token, platform },
    });
    logger.info('Mobile device token registered', { userId, platform });
  }

  async removeToken(token: string): Promise<void> {
    await (prisma as any).mobileDeviceToken.updateMany({
      where: { token },
      data: { isValid: false },
    });
    logger.info('Mobile device token removed', { token: token.substring(0, 8) + '...' });
  }

  async getTokensForUser(userId: string): Promise<Array<{ token: string; platform: string }>> {
    return (prisma as any).mobileDeviceToken.findMany({
      where: { userId, isValid: true },
      select: { token: true, platform: true },
    });
  }

  async markTokenInvalid(token: string): Promise<void> {
    await (prisma as any).mobileDeviceToken.updateMany({
      where: { token },
      data: { isValid: false },
    });
  }

  async pruneExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const result = await (prisma as any).mobileDeviceToken.deleteMany({
      where: { OR: [{ isValid: false }, { createdAt: { lt: cutoff } }] },
    });
    logger.info('Pruned expired mobile tokens', { count: result.count });
  }
}

export const deviceTokenService = new DeviceTokenService();
