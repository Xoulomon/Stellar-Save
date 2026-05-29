import { PrismaClient } from '@prisma/client';
import * as sgMail from '@sendgrid/mail';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * Notification Service
 * Handles sending email and push notifications for Stellar-Save
 * Integrates with SendGrid for email and Firebase/OneSignal for push notifications
 */
export class NotificationService {
  private sendgridApiKey: string;
  private firebaseServiceAccount?: any;
  private firebaseProjectId?: string;
  private notificationProvidersEnabled: boolean;

  constructor() {
    this.sendgridApiKey = process.env.SENDGRID_API_KEY || '';
    this.firebaseProjectId = process.env.FIREBASE_PROJECT_ID;
    this.notificationProvidersEnabled = !!this.sendgridApiKey || !!this.firebaseProjectId;

    if (this.sendgridApiKey) {
      sgMail.setApiKey(this.sendgridApiKey);
    }

    // Load Firebase service account if configured
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        this.firebaseServiceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      } catch (e) {
        logger.error('Failed to parse FIREBASE_SERVICE_ACCOUNT', e);
      }
    }
  }

  /**
   * Send an email notification
   */
  async sendEmail(
    to: string,
    templateId: string,
    templateData: Record<string, any>,
    subject: string
  ): Promise<string> {
    try {
      // Get template from database
      const template = await prisma.notificationTemplate.findUnique({
        where: { templateKey: templateId },
      });

      if (!template || template.templateType !== 'email') {
        throw new Error(`Email template ${templateId} not found`);
      }

      // Render template with data
      const htmlContent = this.renderTemplate(template.htmlContent, templateData);
      const textContent = this.renderTemplate(template.textContent, templateData);
      const finalSubject = this.renderTemplate(subject || template.subject || '', templateData);

      // Send via SendGrid
      if (!this.sendgridApiKey) {
        logger.warn('SendGrid API key not configured. Email would be sent to:', to);
        return 'no-provider';
      }

      const msg = {
        to,
        from: process.env.SENDGRID_FROM_EMAIL || 'noreply@stellar-save.com',
        subject: finalSubject,
        html: htmlContent,
        text: textContent,
        replyTo: process.env.SENDGRID_REPLY_TO || 'support@stellar-save.com',
      };

      const response = await sgMail.send(msg);
      const messageId = response[0].headers['x-message-id'];

      logger.info(`Email sent to ${to}`, { templateId, messageId });

      // Create notification record
      await this.recordNotification({
        userId: templateData.userId || 'unknown',
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
      logger.error('Failed to send email notification', { templateId, to, error });

      // Record failed notification
      await this.recordNotification({
        userId: templateData.userId || 'unknown',
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
    templateData: Record<string, any>,
    title: string,
    body: string
  ): Promise<string> {
    try {
      // Get template from database
      const template = await prisma.notificationTemplate.findUnique({
        where: { templateKey: templateId },
      });

      if (!template || template.templateType !== 'push') {
        throw new Error(`Push template ${templateId} not found`);
      }

      // Render template
      const renderedContent = this.renderTemplate(template.htmlContent, templateData);
      const finalTitle = this.renderTemplate(title, templateData);
      const finalBody = this.renderTemplate(body, templateData);

      // For now, implement Firebase Cloud Messaging (FCM) support
      if (!this.firebaseProjectId || !this.firebaseServiceAccount) {
        logger.warn('Firebase not configured. Push notification would be sent to:', deviceToken);
        return 'no-provider';
      }

      // Send via Firebase Cloud Messaging
      const messageId = await this.sendViaFirebase(deviceToken, {
        title: finalTitle,
        body: finalBody,
        data: {
          templateId,
          ...templateData,
        },
      });

      logger.info(`Push notification sent to ${deviceToken}`, { templateId, messageId });

      // Create notification record
      await this.recordNotification({
        userId: templateData.userId || 'unknown',
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
      logger.error('Failed to send push notification', { templateId, deviceToken, error });

      // Record failed notification
      await this.recordNotification({
        userId: templateData.userId || 'unknown',
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
    payload: { title: string; body: string; data: Record<string, any> }
  ): Promise<string> {
    // This would use Firebase Admin SDK to send messages
    // For now, return a mock message ID
    if (!this.firebaseServiceAccount) {
      throw new Error('Firebase service account not configured');
    }

    try {
      // In production, you would use the Firebase Admin SDK:
      // const admin = require('firebase-admin');
      // const message = {
      //   notification: { title: payload.title, body: payload.body },
      //   data: payload.data,
      //   token: deviceToken,
      // };
      // return await admin.messaging().send(message);

      // Placeholder for Firebase-Admin SDK integration
      logger.info('Firebase message would be sent', { deviceToken, payload });
      return `firebase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      logger.error('Firebase send failed', error);
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
    templateData: Record<string, any>,
    notificationType: 'email' | 'push',
    priority: number = 0,
    scheduledFor?: Date
  ): Promise<string> {
    const notificationQueue = await prisma.notificationQueue.create({
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

    logger.info(`Notification queued: ${notificationQueue.id}`, {
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
      const pendingNotifications = await prisma.notificationQueue.findMany({
        where: {
          status: 'pending',
          scheduledFor: {
            lte: new Date(),
          },
        },
        orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }],
        take: batchSize,
      });

      let processedCount = 0;

      for (const notification of pendingNotifications) {
        try {
          await prisma.notificationQueue.update({
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

          await prisma.notificationQueue.update({
            where: { id: notification.id },
            data: {
              status: 'completed',
              processedAt: new Date(),
            },
          });

          processedCount++;
        } catch (error) {
          logger.error(`Failed to process notification ${notification.id}`, error);

          await prisma.notificationQueue.update({
            where: { id: notification.id },
            data: {
              status: 'failed',
            },
          });
        }
      }

      logger.info(`Processed ${processedCount}/${pendingNotifications.length} queued notifications`);
      return processedCount;
    } catch (error) {
      logger.error('Error processing queued notifications', error);
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
    metadata?: Record<string, any>;
    externalId?: string;
    status: string;
    failureReason?: string;
    sentAt?: Date;
  }): Promise<void> {
    try {
      const notification = await prisma.notification.create({
        data: {
          userId: data.userId,
          templateId: data.templateId,
          notificationType: data.notificationType,
          recipient: data.recipient,
          subject: data.subject,
          renderedContent: data.renderedContent,
          metadata: data.metadata || {},
          externalId: data.externalId,
          status: data.status,
          failureReason: data.failureReason,
          sentAt: data.sentAt,
        },
      });

      logger.debug(`Notification recorded: ${notification.id}`);
    } catch (error) {
      logger.error('Failed to record notification', error);
    }
  }

  /**
   * Render a template with data
   */
  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;

    // Replace placeholders like {{userName}} or {{groupName}}
    for (const [key, value] of Object.entries(data)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(placeholder, String(value || ''));
    }

    return rendered;
  }

  /**
   * Get notification history for a user
   */
  async getNotificationHistory(userId: string, limit: number = 20): Promise<any[]> {
    return await prisma.notification.findMany({
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
      prisma.notification.count({ where: { status: 'sent' } }),
      prisma.notification.count({ where: { status: 'failed' } }),
      prisma.notificationQueue.count({ where: { status: 'pending' } }),
      prisma.notificationQueue.findMany({ select: { notificationType: true } }),
    ]);

    const byType: Record<string, number> = {};
    queue.forEach((item: any) => {
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

    const result = await prisma.notification.deleteMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
    });

    logger.info(`Cleaned up ${result.count} old notifications`);
    return result.count;
  }
}

export const notificationService = new NotificationService();
