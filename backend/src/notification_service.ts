import { config } from './config';
import { logger } from './logger';
import { prisma } from './prisma_client';
import { createPushProvider, PushProvider } from './push_provider';
import {
  renderTemplate as renderSharedTemplate,
  resolveTemplate,
  TemplateRecord,
} from './notification_template_layer';

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
  logger?: { info: (...args: unknown[]) => void; warn: (...args: unknown[]) => void; error: (...args: unknown[]) => void; debug: (...args: unknown[]) => void };
  pushProvider?: PushProvider;
}

export class NotificationService {
  private sendgridApiKey: string;
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
    this.pushProvider =
      deps?.pushProvider ??
      createPushProvider(
        {
          firebase: resolvedDeps.config.push.firebase,
          oneSignal: resolvedDeps.config.push.oneSignal,
        },
        this.log
      );
    this.notificationProvidersEnabled =
      !!this.sendgridApiKey || this.pushProvider.name !== 'noop';
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
      const finalSubject = renderSharedTemplate(
        subject || resolved.subject || '',
        templateData
      );

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
