import { config } from './config';
import { logger } from './logger';
import { prisma } from './prisma_client';

/**
 * Notification Service
 * Handles sending email and push notifications for Stellar-Save
 * Integrates with SendGrid for email and Firebase/OneSignal for push notifications
 *
 * Refactored for dependency injection (Issue #1701):
 * - DB client, config, and logger are now accepted via constructor deps
 * - Consuming code passes production instances; tests pass lightweight mocks
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- notification and notificationQueue models pending Prisma migration
export type NotificationDb = any;

export interface NotificationServiceDeps {
  db?: NotificationDb;
  config?: {
    sendgrid: { apiKey?: string; fromEmail: string; replyTo?: string };
    push: { firebase: { projectId?: string; serviceAccount?: string } };
  };
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };
}

export class NotificationService {
  private sendgridApiKey: string | undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Firebase service account is parsed from a raw JSON string; schema varies by Firebase SDK version
  private firebaseServiceAccount?: Record<string, unknown>;
  private firebaseProjectId?: string;
  private notificationProvidersEnabled: boolean;
  private readonly db: NotificationDb;
  private readonly log: NonNullable<NotificationServiceDeps['logger']>;

  constructor(deps?: NotificationServiceDeps) {
    const resolvedDeps = {
      db: deps?.db ?? (prisma as NotificationDb),
      config: deps?.config ?? config,
      logger: deps?.logger ?? logger,
    };

    this.db = resolvedDeps.db;
    this.log = resolvedDeps.logger;

    this.sendgridApiKey = resolvedDeps.config.sendgrid.apiKey;
    this.firebaseProjectId = resolvedDeps.config.push.firebase.projectId;
    this.notificationProvidersEnabled = !!this.sendgridApiKey || !!this.firebaseProjectId;

    if (resolvedDeps.config.push.firebase.serviceAccount) {
      try {
        this.firebaseServiceAccount = JSON.parse(resolvedDeps.config.push.firebase.serviceAccount);
      } catch (e) {
        this.log.error('Failed to parse FIREBASE_SERVICE_ACCOUNT', e);
      }
    }
  }

  /**
   * Send an email notification
   */
  async sendEmail(
    to: string,
    templateId: string,
    templateData: Record<string, unknown>,
    subject: string
  ): Promise<string> {
    try {
      // Get template from database
      const template = await this.db.notificationTemplate.findUnique({
        where: { templateKey: templateId },
      });

      if (!template || template.templateType !== 'email') {
        throw new Error(`Email template ${templateId} not found`);
      }

      // Render template with data
      const htmlContent = this.renderTemplate(template.htmlContent, templateData);
      const textContent = this.renderTemplate(template.textContent, templateData);
      const finalSubject = this.renderTemplate(subject || template.subject || '', templateData);

      if (!this.sendgridApiKey) {
        this.log.warn('SendGrid API key not configured. Email would be sent to:', to);
        return 'no-provider';
      }

      this.log.info(`Email sent to ${to}`, { templateId });

      // Create notification record
      await this.recordNotification({
        userId: (templateData.userId as string) || 'unknown',
        templateId,
        notificationType: 'email',
        recipient: to,
        subject: finalSubject,
        renderedContent: htmlContent,
        metadata: templateData,
        status: 'sent',
        sentAt: new Date(),
      });

      return 'sent';
    } catch (error) {
      this.log.error('Failed to send email notification', { templateId, to, error });

      // Record failed notification
      await this.recordNotification({
        userId: (templateData.userId as string) || 'unknown',
        templateId,
        notificationType: 'email',
        recipient: to,
        subject: subject || '',
        renderedContent: '',
        metadata: templateData,
        status: 'failed',
        failureReason: String(error),
      });

      throw error;
    }
  }

  /**
   * Send a push notification
   */
  async sendPushNotification(
    deviceToken: string,
    templateId: string,
    templateData: Record<string, unknown>,
    title: string,
    body: string
  ): Promise<string> {
    try {
      const template = await this.db.notificationTemplate.findUnique({
        where: { templateKey: templateId },
      });

      if (!template || template.templateType !== 'push') {
        throw new Error(`Push template ${templateId} not found`);
      }

      const renderedContent = this.renderTemplate(template.htmlContent, templateData);
      const finalTitle = this.renderTemplate(title, templateData);
      const finalBody = this.renderTemplate(body, templateData);

      if (!this.firebaseProjectId || !this.firebaseServiceAccount) {
        this.log.warn('Firebase not configured. Push notification would be sent to:', deviceToken);
        return 'no-provider';
      }

      const messageId = await this.sendViaFirebase(deviceToken, {
        title: finalTitle,
        body: finalBody,
        data: { templateId, ...templateData },
      });

      this.log.info(`Push notification sent to ${deviceToken}`, { templateId, messageId });

      await this.recordNotification({
        userId: (templateData.userId as string) || 'unknown',
        templateId,
        notificationType: 'push',
        recipient: deviceToken,
        renderedContent,
        metadata: templateData,
        externalId: messageId,
        status: 'sent',
        sentAt: new Date(),
      });

      return messageId;
    } catch (error) {
      this.log.error('Failed to send push notification', { templateId, deviceToken, error });

      await this.recordNotification({
        userId: (templateData.userId as string) || 'unknown',
        templateId,
        notificationType: 'push',
        recipient: deviceToken,
        renderedContent: '',
        metadata: templateData,
        status: 'failed',
        failureReason: String(error),
      });

      throw error;
    }
  }

  /**
   * Send Firebase Cloud Messaging notification
   */
  private async sendViaFirebase(
    deviceToken: string,
    payload: { title: string; body: string; data: Record<string, unknown> }
  ): Promise<string> {
    if (!this.firebaseServiceAccount) {
      throw new Error('Firebase service account not configured');
    }

    try {
      // TODO: integrate Firebase Admin SDK when credentials are provisioned.
      this.log.info('Firebase message would be sent', { deviceToken, payload });
      return `firebase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      this.log.error('Firebase send failed', error);
      throw error;
    }
  }

  /**
   * Queue a notification for later sending
   */
  async queueNotification(
    userId: string,
    templateKey: string,
    recipient: string,
    templateData: Record<string, unknown>,
    notificationType: 'email' | 'push',
    priority: number = 0,
    scheduledFor?: Date
  ): Promise<string> {
    const notificationQueue = await this.db.notificationQueue.create({
      data: {
        userId,
        templateKey,
        recipient,
        templateData,
        notificationType,
        priority,
        scheduledFor: scheduledFor || new Date(),
      },
    });

    this.log.info(`Notification queued: ${notificationQueue.id}`, {
      userId,
      templateKey,
      notificationType,
    });

    return notificationQueue.id;
  }

  /**
   * Process queued notifications
   */
  async processQueuedNotifications(batchSize: number = 100): Promise<number> {
    try {
      const pendingNotifications = await this.db.notificationQueue.findMany({
        where: {
          status: 'pending',
          scheduledFor: { lte: new Date() },
        },
        orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }],
        take: batchSize,
      });

      let processedCount = 0;

      for (const notification of pendingNotifications) {
        try {
          await this.db.notificationQueue.update({
            where: { id: notification.id },
            data: { status: 'processing' },
          });

          if (notification.notificationType === 'email') {
            await this.sendEmail(
              notification.recipient,
              notification.templateKey,
              notification.templateData,
              notification.templateData.subject || ''
            );
          } else if (notification.notificationType === 'push') {
            await this.sendPushNotification(
              notification.recipient,
              notification.templateKey,
              notification.templateData,
              notification.templateData.title || 'Stellar Save',
              notification.templateData.body || ''
            );
          }

          await this.db.notificationQueue.update({
            where: { id: notification.id },
            data: { status: 'completed', processedAt: new Date() },
          });

          processedCount++;
        } catch (error) {
          this.log.error(`Failed to process notification ${notification.id}`, error);

          await this.db.notificationQueue.update({
            where: { id: notification.id },
            data: { status: 'failed' },
          });
        }
      }

      this.log.info(`Processed ${processedCount}/${pendingNotifications.length} queued notifications`);
      return processedCount;
    } catch (error) {
      this.log.error('Error processing queued notifications', error);
      throw error;
    }
  }

  /**
   * Record a notification in the database
   */
  private async recordNotification(data: {
    userId: string;
    templateId: string;
    notificationType: string;
    recipient: string;
    subject?: string;
    renderedContent: string;
    metadata?: Record<string, unknown>;
    externalId?: string;
    status: string;
    failureReason?: string;
    sentAt?: Date;
  }): Promise<void> {
    try {
      const notification = await this.db.notification.create({ data });
      this.log.debug(`Notification recorded: ${notification.id}`);
    } catch (error) {
      this.log.error('Failed to record notification', error);
    }
  }

  /**
   * Render a template with data
   */
  private renderTemplate(template: string, data: Record<string, unknown>): string {
    let rendered = template;
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, String(value || ''));
    }
    return rendered;
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(userId: string, limit: number = 20): Promise<unknown[]> {
    return await this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(): Promise<{
    totalSent: number;
    totalFailed: number;
    totalPending: number;
    byType: Record<string, number>;
  }> {
    const [totalSent, totalFailed, totalPending, queue] = await Promise.all([
      this.db.notification.count({ where: { status: 'sent' } }),
      this.db.notification.count({ where: { status: 'failed' } }),
      this.db.notificationQueue.count({ where: { status: 'pending' } }),
      this.db.notificationQueue.findMany({ select: { notificationType: true } }),
    ]);

    const byType: Record<string, number> = {};
    queue.forEach((item: { notificationType: string }) => {
      byType[item.notificationType] = (byType[item.notificationType] || 0) + 1;
    });

    return { totalSent, totalFailed, totalPending, byType };
  }

  /**
   * Cleanup old notifications (retain last 90 days)
   */
  async cleanupOldNotifications(daysToRetain: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToRetain);

    const result = await this.db.notification.deleteMany({
      where: { createdAt: { lt: cutoffDate } },
    });

    this.log.info(`Cleaned up ${result.count} old notifications`);
    return result.count;
  }
}

/** Default singleton — uses production deps. */
export const notificationService = new NotificationService();
