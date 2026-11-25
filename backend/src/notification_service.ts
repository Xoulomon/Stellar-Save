import sgMail from '@sendgrid/mail';

import { config } from './config';
import { logger } from './logger';
import { prisma } from './prisma_client';
import { createPushProvider } from './push_provider';

import type { PushProvider } from './push_provider';

interface TemplateRecord {
  templateType: 'email' | 'push';
  subject?: string | null;
  htmlContent: string;
  textContent: string;
}

function resolveTemplate(
  template: TemplateRecord | null,
  type: TemplateRecord['templateType'],
  templateId: string
): TemplateRecord {
  if (!template || template.templateType !== type) {
    throw new Error(`Notification template not found: ${templateId}`);
  }
  return template;
}

function renderSharedTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_placeholder, key: string) => String(data[key] ?? ''));
}

/**
 * Notification Service
 * Handles sending email and push notifications for Stellar-Save
 * Integrates with SendGrid for email and Firebase/OneSignal for push notifications
 *
 * Refactored for dependency injection (Issue #1701):
 * - DB client, config, and logger are now accepted via constructor deps
 * - Consuming code passes production instances; tests pass lightweight mocks
 *
 * Push sending is delegated to a PushProvider (Issue #1872).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- notification and notificationQueue models pending Prisma migration
export type NotificationDb = any;

export interface NotificationServiceDeps {
  db?: NotificationDb;
  config?: {
    sendgrid: { apiKey: string; fromEmail: string; replyTo?: string };
    push: {
      firebase: { projectId?: string; serviceAccount?: string };
      oneSignal?: { appId?: string; apiKey?: string };
    };
  };
  logger?: {
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
    debug: (...args: unknown[]) => void;
  };
  pushProvider?: PushProvider;
}

export class NotificationService {
  private sendgridApiKey: string;
  private readonly emailConfig: NonNullable<NotificationServiceDeps['config']>['sendgrid'];
  private notificationProvidersEnabled: boolean;
  private readonly pushProvider: PushProvider;
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
    this.emailConfig = resolvedDeps.config.sendgrid;
    if (this.sendgridApiKey) {
      sgMail.setApiKey(this.sendgridApiKey);
    }

    const pushConfig = resolvedDeps.config.push;
    const oneSignal = 'onesignal' in pushConfig ? pushConfig.onesignal : pushConfig.oneSignal;
    this.pushProvider =
      deps?.pushProvider ??
      createPushProvider(
        {
          firebase: pushConfig.firebase,
          oneSignal,
        },
        this.log
      );
    this.notificationProvidersEnabled = !!this.sendgridApiKey || this.pushProvider.name !== 'noop';
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

      const resolved = resolveTemplate(template as TemplateRecord | null, 'email', templateId);

      // Render template with data via shared template layer
      const htmlContent = renderSharedTemplate(resolved.htmlContent, templateData);
      const finalSubject = renderSharedTemplate(subject || resolved.subject || '', templateData);

      if (!this.sendgridApiKey) {
        this.log.warn('SendGrid API key not configured. Email would be sent to:', to);
        return 'no-provider';
      }

      const [response] = await sgMail.send({
        to,
        from: this.emailConfig.fromEmail,
        subject: finalSubject,
        html: htmlContent,
        text: renderSharedTemplate(resolved.textContent, templateData),
        replyTo: this.emailConfig.replyTo,
      });
      const messageId = response.headers['x-message-id'] || 'sent';

      this.log.info(`Email sent to ${to}`, { templateId, messageId });

      await this.recordNotification({
        userId: (templateData.userId as string) || 'unknown',
        templateId,
        notificationType: 'email',
        recipient: to,
        subject: finalSubject,
        renderedContent: htmlContent,
        metadata: templateData,
        externalId: messageId,
        status: 'sent',
        sentAt: new Date(),
      });

      return messageId;
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

      const resolved = resolveTemplate(template as TemplateRecord | null, 'push', templateId);

      const renderedContent = renderSharedTemplate(resolved.htmlContent, templateData);
      const finalTitle = renderSharedTemplate(title, templateData);
      const finalBody = renderSharedTemplate(body, templateData);

      const messageId = await this.pushProvider.send(deviceToken, {
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

          const templateData = notification.templateData as Record<string, unknown>;
          if (notification.notificationType === 'email') {
            await this.sendEmail(
              notification.recipient,
              notification.templateKey,
              templateData,
              String(templateData.subject ?? '')
            );
          } else if (notification.notificationType === 'push') {
            await this.sendPushNotification(
              notification.recipient,
              notification.templateKey,
              templateData,
              String(templateData.title ?? 'Stellar Save'),
              String(templateData.body ?? '')
            );
          }

          await this.db.notificationQueue.update({
            where: { id: notification.id },
            data: { status: 'completed', processedAt: new Date() },
          });
          processedCount += 1;
        } catch (error) {
          this.log.error(`Failed to process notification ${notification.id}`, error);
          await this.db.notificationQueue.update({
            where: { id: notification.id },
            data: { status: 'failed' },
          });
        }
      }

      return processedCount;
    } catch (error) {
      this.log.error('Error processing queued notifications', error);
      throw error;
    }
  }

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
    await this.db.notification.create({
      data: {
        ...data,
        metadata: data.metadata ?? {},
      },
    });
  }

  async getNotificationHistory(userId: string, limit: number = 20): Promise<unknown[]> {
    return this.db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

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
    for (const item of queue) {
      byType[item.notificationType] = (byType[item.notificationType] ?? 0) + 1;
    }

    return { totalSent, totalFailed, totalPending, byType };
  }

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

export const notificationService = new NotificationService();
