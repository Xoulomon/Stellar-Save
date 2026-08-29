import crypto from 'crypto';
import { logger } from './logger';
import { notificationPreferenceRepository } from './modules/notifications/notification-preference.repository';

/**
 * User Preference Manager Service
 * Manages notification preferences and subscriptions for users
 */
export class UserPreferenceManager {
  /**
   * Get or create user preferences
   */
  static async getOrCreatePreferences(userId: string) {
    let preferences = await notificationPreferenceRepository.findByUserId(userId);

    if (!preferences) {
      // Create default preferences for new user
      preferences = await notificationPreferenceRepository.create({
        userId,
        emailNotifications: true,
        pushNotifications: true,
        contributionReminders: true,
        groupUpdates: true,
        payoutNotifications: true,
        emailFrequency: 'immediate',
        unsubscribeToken: crypto.randomUUID(),
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
    const preferences = await notificationPreferenceRepository.updateByUserId(userId, updates);

    logger.info(`Updated preferences for user: ${userId}`, updates);
    return preferences;
  }

  /**
   * Get preferences by unsubscribe token
   * Used for one-click unsubscribe links
   */
  static async getPreferencesByUnsubscribeToken(token: string) {
    return await notificationPreferenceRepository.findByUnsubscribeToken(token);
  }

  /**
   * Unsubscribe user from all notifications
   */
  static async unsubscribeUser(token: string) {
    const preferences = await this.getPreferencesByUnsubscribeToken(token);

    if (!preferences) {
      throw new Error('Invalid unsubscribe token');
    }

    return await notificationPreferenceRepository.updateById(preferences.id, {
      emailNotifications: false,
      pushNotifications: false,
      emailFrequency: 'never',
    });
  }

  /**
   * Re-subscribe user to notifications
   */
  static async resubscribeUser(userId: string) {
    return await notificationPreferenceRepository.updateByUserId(userId, {
      emailNotifications: true,
      pushNotifications: true,
      emailFrequency: 'immediate',
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
    return await notificationPreferenceRepository.userIdsForDigest(frequency);
  }

  /**
   * Regenerate unsubscribe token for a user
   */
  static async regenerateUnsubscribeToken(userId: string) {
    return await notificationPreferenceRepository.updateByUserId(userId, {
      unsubscribeToken: crypto.randomUUID(),
    });
  }

  /**
   * Register device token for push notifications
   */
  static async registerDeviceToken(userId: string, deviceToken: string, platform: string) {
    // TODO: persist via Prisma once the DeviceToken model is added to the schema.
    logger.info(`Device token registered for user: ${userId}`, { platform });
    return { userId, deviceToken, platform, registeredAt: new Date() };
  }

  /**
   * Unregister device token
   */
  static async unregisterDeviceToken(userId: string, deviceToken: string) {
    logger.info(`Device token unregistered for user: ${userId}`);
    // TODO: persist via Prisma once the DeviceToken model is added to the schema.
    return { userId, deviceToken, unregisteredAt: new Date() };
  }

  /**
   * Get all device tokens for a user
   */
  static async getUserDeviceTokens(userId: string): Promise<string[]> {
    // TODO: query via Prisma once the DeviceToken model is added to the schema.
    logger.info(`Retrieved device tokens for user: ${userId}`);
    return [];
  }

  /**
   * Get aggregate notification preferences statistics
   */
  static async getPreferenceStats() {
    const total = await notificationPreferenceRepository.count();
    const emailEnabled = await notificationPreferenceRepository.count({ emailNotifications: true });
    const pushEnabled = await notificationPreferenceRepository.count({ pushNotifications: true });

    const byFrequency = await notificationPreferenceRepository.countByEmailFrequency();

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
    const count = await notificationPreferenceRepository.updateManyByUserIds(userIds, updates);

    logger.info(`Batch updated ${count} user preferences`);
    return { count };
  }
}

export const userPreferenceManager = UserPreferenceManager;
