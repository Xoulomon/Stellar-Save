import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * User Preference Manager Service
 * Manages notification preferences and subscriptions for users
 */
export class UserPreferenceManager {
  /**
   * Get or create user preferences
   */
  static async getOrCreatePreferences(userId: string) {
    let preferences = await prisma.notificationPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Create default preferences for new user
      preferences = await prisma.notificationPreference.create({
        data: {
          userId,
          emailNotifications: true,
          pushNotifications: true,
          contributionReminders: true,
          groupUpdates: true,
          payoutNotifications: true,
          emailFrequency: 'immediate',
          unsubscribeToken: crypto.randomUUID(),
        },
      });

      logger.info(`Created default preferences for user: ${userId}`);
    }

    return preferences;
  }

  /**
   * Update user preferences
   */
  static async updatePreferences(
    userId: string,
    updates: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      contributionReminders?: boolean;
      groupUpdates?: boolean;
      payoutNotifications?: boolean;
      emailFrequency?: 'immediate' | 'daily' | 'weekly' | 'never';
    }
  ) {
    const preferences = await prisma.notificationPreference.update({
      where: { userId },
      data: updates,
    });

    logger.info(`Updated preferences for user: ${userId}`, updates);
    return preferences;
  }

  /**
   * Get preferences by unsubscribe token
   * Used for one-click unsubscribe links
   */
  static async getPreferencesByUnsubscribeToken(token: string) {
    return await prisma.notificationPreference.findUnique({
      where: { unsubscribeToken: token },
    });
  }

  /**
   * Unsubscribe user from all notifications
   */
  static async unsubscribeUser(token: string) {
    const preferences = await this.getPreferencesByUnsubscribeToken(token);

    if (!preferences) {
      throw new Error('Invalid unsubscribe token');
    }

    return await prisma.notificationPreference.update({
      where: { id: preferences.id },
      data: {
        emailNotifications: false,
        pushNotifications: false,
        emailFrequency: 'never',
      },
    });
  }

  /**
   * Re-subscribe user to notifications
   */
  static async resubscribeUser(userId: string) {
    return await prisma.notificationPreference.update({
      where: { userId },
      data: {
        emailNotifications: true,
        pushNotifications: true,
        emailFrequency: 'immediate',
      },
    });
  }

  /**
   * Check if user wants to receive a specific notification type
   */
  static async shouldSendNotification(
    userId: string,
    notificationType: 'email' | 'push',
    eventType: string
  ): Promise<boolean> {
    const preferences = await this.getOrCreatePreferences(userId);

    // Check if notification type is enabled
    if (notificationType === 'email' && !preferences.emailNotifications) {
      return false;
    }

    if (notificationType === 'push' && !preferences.pushNotifications) {
      return false;
    }

    // Check if email frequency allows immediate sending
    if (notificationType === 'email' && preferences.emailFrequency === 'never') {
      return false;
    }

    // Check specific event preferences
    if (eventType.includes('contribution_reminder') && !preferences.contributionReminders) {
      return false;
    }

    if (eventType.includes('group_update') && !preferences.groupUpdates) {
      return false;
    }

    if (eventType.includes('payout') && !preferences.payoutNotifications) {
      return false;
    }

    return true;
  }

  /**
   * Get users who should receive digest emails
   */
  static async getUsersForDigest(frequency: 'daily' | 'weekly'): Promise<string[]> {
    const preferences = await prisma.notificationPreference.findMany({
      where: {
        emailNotifications: true,
        emailFrequency: frequency,
      },
      select: { userId: true },
    });

    return preferences.map((p) => p.userId);
  }

  /**
   * Regenerate unsubscribe token for a user
   */
  static async regenerateUnsubscribeToken(userId: string) {
    return await prisma.notificationPreference.update({
      where: { userId },
      data: {
        unsubscribeToken: crypto.randomUUID(),
      },
    });
  }

  /**
   * Register device token for push notifications
   */
  static async registerDeviceToken(userId: string, deviceToken: string, platform: string) {
    // In a full implementation, you would store device tokens in a separate table
    // For now, this is a placeholder for device management
    logger.info(`Device token registered for user: ${userId}`, { platform });

    // In production:
    // return await prisma.deviceToken.create({
    //   data: { userId, deviceToken, platform, active: true },
    // });

    return { userId, deviceToken, platform, registeredAt: new Date() };
  }

  /**
   * Unregister device token
   */
  static async unregisterDeviceToken(userId: string, deviceToken: string) {
    logger.info(`Device token unregistered for user: ${userId}`);

    // In production:
    // return await prisma.deviceToken.delete({
    //   where: { deviceToken, userId },
    // });

    return { userId, deviceToken, unregisteredAt: new Date() };
  }

  /**
   * Get all device tokens for a user
   */
  static async getUserDeviceTokens(userId: string): Promise<string[]> {
    // In production:
    // const tokens = await prisma.deviceToken.findMany({
    //   where: { userId, active: true },
    //   select: { deviceToken: true },
    // });
    // return tokens.map((t) => t.deviceToken);

    logger.info(`Retrieved device tokens for user: ${userId}`);
    return [];
  }

  /**
   * Get aggregate notification preferences statistics
   */
  static async getPreferenceStats() {
    const total = await prisma.notificationPreference.count();
    const emailEnabled = await prisma.notificationPreference.count({
      where: { emailNotifications: true },
    });
    const pushEnabled = await prisma.notificationPreference.count({
      where: { pushNotifications: true },
    });

    const byFrequency = await prisma.notificationPreference.groupBy({
      by: ['emailFrequency'],
      _count: true,
    });

    return {
      total,
      emailEnabled,
      pushEnabled,
      emailEnabledPercent: total > 0 ? ((emailEnabled / total) * 100).toFixed(2) : 0,
      pushEnabledPercent: total > 0 ? ((pushEnabled / total) * 100).toFixed(2) : 0,
      byFrequency: Object.fromEntries(
        byFrequency.map((group: any) => [group.emailFrequency, group._count])
      ),
    };
  }

  /**
   * Batch update preferences for multiple users
   */
  static async batchUpdatePreferences(
    userIds: string[],
    updates: {
      emailNotifications?: boolean;
      pushNotifications?: boolean;
      emailFrequency?: string;
    }
  ) {
    const result = await prisma.notificationPreference.updateMany({
      where: {
        userId: {
          in: userIds,
        },
      },
      data: updates,
    });

    logger.info(`Batch updated ${result.count} user preferences`);
    return result;
  }
}

export const userPreferenceManager = UserPreferenceManager;
