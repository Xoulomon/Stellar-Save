import { Router } from 'express';

import { config } from '../config';
import { deviceTokenService } from '../device_token_service';
import { AppError } from '../lib/errors';
import { logger } from '../logger';
import { NotificationService } from '../notification_service';
import { NotificationTemplateManager } from '../notification_template_manager';
import { PushNotificationService } from '../push_notification_service';
import { UserPreferenceManager } from '../user_preference_manager';
import { WebPushService } from '../web_push_service';

import type { Request, Response, NextFunction } from 'express';

/**
 * Notification Service Routes
 * Endpoints for managing notifications, preferences, and templates
 */
export function createNotificationRouter(): Router {
  const router = Router();
  const notificationService = new NotificationService();
  const pushNotificationService = new PushNotificationService();
  const webPushService = new WebPushService();

  // ========== PREFERENCE MANAGEMENT ROUTES ==========

  /**
   * GET /api/v1/notifications/preferences/:userId
   * Get user's notification preferences
   */
  router.get('/preferences/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const preferences = await UserPreferenceManager.getOrCreatePreferences(userId);
      res.json(preferences);
    } catch (error) {
      logger.error('Error fetching preferences', { error: String(error) });
      next(new AppError('PREFERENCES_FETCH_FAILED', 'Failed to fetch preferences', 500));
    }
  });

  /**
   * PUT /api/v1/notifications/preferences/:userId
   * Update user's notification preferences
   */
  router.put('/preferences/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const {
        emailNotifications,
        pushNotifications,
        contributionReminders,
        groupUpdates,
        payoutNotifications,
        emailFrequency,
      } = req.body;

      // Validate frequency
      if (emailFrequency && !['immediate', 'daily', 'weekly', 'never'].includes(emailFrequency)) {
        return next(new AppError('INVALID_EMAIL_FREQUENCY', 'Invalid emailFrequency', 400));
      }

      const updated = await UserPreferenceManager.updatePreferences(userId, {
        emailNotifications,
        pushNotifications,
        contributionReminders,
        groupUpdates,
        payoutNotifications,
        emailFrequency,
      });

      res.json({ message: 'Preferences updated', preferences: updated });
    } catch (error) {
      logger.error('Error updating preferences', { error: String(error) });
      next(new AppError('PREFERENCES_UPDATE_FAILED', 'Failed to update preferences', 500));
    }
  });

  /**
   * GET /api/v1/notifications/preferences/stats
   * Get aggregate preference statistics
   */
  router.get('/preferences/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await UserPreferenceManager.getPreferenceStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error fetching preference stats', { error: String(error) });
      next(new AppError('PREFERENCE_STATS_FETCH_FAILED', 'Failed to fetch statistics', 500));
    }
  });

  /**
   * POST /api/v1/notifications/device-token
   * Register device token for push notifications
   */
  router.post('/device-token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, deviceToken, platform } = req.body;

      if (!userId || !deviceToken || !platform) {
        return next(
          new AppError('MISSING_FIELDS', 'userId, deviceToken, and platform are required', 400)
        );
      }

      const registered = await UserPreferenceManager.registerDeviceToken(
        userId,
        deviceToken,
        platform
      );

      res.status(201).json({
        message: 'Device token registered',
        data: registered,
      });
    } catch (error) {
      logger.error('Error registering device token', { error: String(error) });
      next(new AppError('DEVICE_TOKEN_REGISTER_FAILED', 'Failed to register device token', 500));
    }
  });

  /**
   * DELETE /api/v1/notifications/device-token/:userId/:deviceToken
   * Unregister device token
   */
  router.delete(
    '/device-token/:userId/:deviceToken',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId, deviceToken } = req.params;

        const unregistered = await UserPreferenceManager.unregisterDeviceToken(userId, deviceToken);

        res.json({
          message: 'Device token unregistered',
          data: unregistered,
        });
      } catch (error) {
        logger.error('Error unregistering device token', { error: String(error) });
        next(
          new AppError('DEVICE_TOKEN_UNREGISTER_FAILED', 'Failed to unregister device token', 500)
        );
      }
    }
  );

  // ========== UNSUBSCRIBE ROUTES ==========

  /**
   * POST /api/v1/notifications/unsubscribe/:token
   * Unsubscribe user via token (one-click unsubscribe)
   */
  router.post('/unsubscribe/:token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { token } = req.params;

      await UserPreferenceManager.unsubscribeUser(token);

      // Return HTML for email link
      res.send(`
        <html>
          <body>
            <h1>Unsubscribed</h1>
            <p>You have been unsubscribed from all notifications.</p>
            <p><a href="${config.urls.frontend}">Return to Stellar-Save</a></p>
          </body>
        </html>
      `);
    } catch (error) {
      logger.error('Error unsubscribing user', { error: String(error) });
      next(new AppError('INVALID_UNSUBSCRIBE_TOKEN', 'Invalid unsubscribe token', 400));
    }
  });

  /**
   * POST /api/v1/notifications/resubscribe/:userId
   * Re-subscribe user to notifications
   */
  router.post('/resubscribe/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      const updated = await UserPreferenceManager.resubscribeUser(userId);

      res.json({
        message: 'User resubscribed to notifications',
        preferences: updated,
      });
    } catch (error) {
      logger.error('Error resubscribing user', { error: String(error) });
      next(new AppError('RESUBSCRIBE_FAILED', 'Failed to resubscribe user', 500));
    }
  });

  // ========== NOTIFICATION SENDING ROUTES ==========

  /**
   * POST /api/v1/notifications/send-email
   * Send an email notification
   */
  router.post('/send-email', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, to, templateId, templateData, subject } = req.body;

      if (!to || !templateId || !templateData) {
        return next(
          new AppError('MISSING_FIELDS', 'to, templateId, and templateData are required', 400)
        );
      }

      // Check preferences
      if (userId) {
        const shouldSend = await UserPreferenceManager.shouldSendNotification(
          userId,
          'email',
          templateId
        );

        if (!shouldSend) {
          return next(
            new AppError(
              'EMAIL_NOTIFICATIONS_DISABLED',
              'User has disabled email notifications for this type',
              403
            )
          );
        }
      }

      const messageId = await notificationService.sendEmail(to, templateId, templateData, subject);

      res.status(202).json({
        message: 'Email notification sent',
        messageId,
      });
    } catch (error) {
      logger.error('Error sending email', { error: String(error) });
      next(new AppError('EMAIL_SEND_FAILED', 'Failed to send email notification', 500));
    }
  });

  /**
   * POST /api/v1/notifications/send-push
   * Send a push notification
   */
  router.post('/send-push', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, deviceToken, templateId, templateData, title, body } = req.body;

      if (!deviceToken || !templateId || !templateData) {
        return next(
          new AppError(
            'MISSING_FIELDS',
            'deviceToken, templateId, and templateData are required',
            400
          )
        );
      }

      // Check preferences
      if (userId) {
        const shouldSend = await UserPreferenceManager.shouldSendNotification(
          userId,
          'push',
          templateId
        );

        if (!shouldSend) {
          return next(
            new AppError(
              'PUSH_NOTIFICATIONS_DISABLED',
              'User has disabled push notifications for this type',
              403
            )
          );
        }
      }

      const messageId = await notificationService.sendPushNotification(
        deviceToken,
        templateId,
        templateData,
        title,
        body
      );

      res.status(202).json({
        message: 'Push notification sent',
        messageId,
      });
    } catch (error) {
      logger.error('Error sending push notification', { error: String(error) });
      next(new AppError('PUSH_SEND_FAILED', 'Failed to send push notification', 500));
    }
  });

  /**
   * POST /api/v1/notifications/queue
   * Queue a notification for later sending
   */
  router.post('/queue', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        userId,
        templateKey,
        recipient,
        templateData,
        notificationType,
        priority,
        scheduledFor,
      } = req.body;

      if (!userId || !templateKey || !recipient || !templateData || !notificationType) {
        return next(
          new AppError(
            'MISSING_FIELDS',
            'userId, templateKey, recipient, templateData, and notificationType are required',
            400
          )
        );
      }

      const queueId = await notificationService.queueNotification(
        userId,
        templateKey,
        recipient,
        templateData,
        notificationType,
        priority || 0,
        scheduledFor ? new Date(scheduledFor) : undefined
      );

      res.status(202).json({
        message: 'Notification queued',
        queueId,
      });
    } catch (error) {
      logger.error('Error queueing notification', { error: String(error) });
      next(new AppError('NOTIFICATION_QUEUE_FAILED', 'Failed to queue notification', 500));
    }
  });

  /**
   * POST /api/v1/notifications/process-queue
   * Process queued notifications
   */
  router.post('/process-queue', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const batchSize = req.body.batchSize || 100;

      const processed = await notificationService.processQueuedNotifications(batchSize);

      res.json({
        message: 'Queue processed',
        processedCount: processed,
      });
    } catch (error) {
      logger.error('Error processing queue', { error: String(error) });
      next(new AppError('QUEUE_PROCESSING_FAILED', 'Failed to process queue', 500));
    }
  });

  // ========== NOTIFICATION HISTORY ROUTES ==========

  /**
   * GET /api/v1/notifications/history/:userId
   * Get notification history for a user
   */
  router.get('/history/:userId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;

      const history = await notificationService.getNotificationHistory(userId, limit);

      res.json({
        userId,
        count: history.length,
        notifications: history,
      });
    } catch (error) {
      logger.error('Error fetching notification history', { error: String(error) });
      next(
        new AppError(
          'NOTIFICATION_HISTORY_FETCH_FAILED',
          'Failed to fetch notification history',
          500
        )
      );
    }
  });

  /**
   * GET /api/v1/notifications/stats
   * Get notification service statistics
   */
  router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stats = await notificationService.getNotificationStats();

      res.json({
        timestamp: new Date(),
        stats,
      });
    } catch (error) {
      logger.error('Error fetching notification stats', { error: String(error) });
      next(new AppError('NOTIFICATION_STATS_FETCH_FAILED', 'Failed to fetch statistics', 500));
    }
  });

  // ========== TEMPLATE MANAGEMENT ROUTES ==========

  /**
   * GET /api/v1/notifications/templates
   * Get all active templates
   */
  router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const templates = await NotificationTemplateManager.getActiveTemplates();

      res.json({
        count: templates.length,
        templates,
      });
    } catch (error) {
      logger.error('Error fetching templates', { error: String(error) });
      next(new AppError('TEMPLATES_FETCH_FAILED', 'Failed to fetch templates', 500));
    }
  });

  /**
   * GET /api/v1/notifications/templates/:templateKey
   * Get a specific template
   */
  router.get('/templates/:templateKey', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateKey } = req.params;

      const template = await NotificationTemplateManager.getTemplate(templateKey);

      if (!template) {
        return next(new AppError('TEMPLATE_NOT_FOUND', 'Template not found', 404));
      }

      res.json(template);
    } catch (error) {
      logger.error('Error fetching template', { error: String(error) });
      next(new AppError('TEMPLATE_FETCH_FAILED', 'Failed to fetch template', 500));
    }
  });

  /**
   * POST /api/v1/notifications/templates
   * Create a new template (admin only)
   */
  router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        templateKey,
        templateName,
        templateType,
        subject,
        htmlContent,
        textContent,
        placeholders,
      } = req.body;

      if (!templateKey || !templateName || !templateType || !htmlContent || !textContent) {
        return next(
          new AppError(
            'MISSING_FIELDS',
            'templateKey, templateName, templateType, htmlContent, and textContent are required',
            400
          )
        );
      }

      const template = await NotificationTemplateManager.createTemplate({
        templateKey,
        templateName,
        templateType,
        subject,
        htmlContent,
        textContent,
        placeholders: placeholders || [],
      });

      res.status(201).json({
        message: 'Template created',
        template,
      });
    } catch (error) {
      logger.error('Error creating template', { error: String(error) });
      next(new AppError('TEMPLATE_CREATE_FAILED', 'Failed to create template', 500));
    }
  });

  /**
   * PUT /api/v1/notifications/templates/:templateKey
   * Update a template (admin only)
   */
  router.put('/templates/:templateKey', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateKey } = req.params;
      const { subject, htmlContent, textContent, active } = req.body;

      const template = await NotificationTemplateManager.updateTemplate(templateKey, {
        subject,
        htmlContent,
        textContent,
        active,
      });

      res.json({
        message: 'Template updated',
        template,
      });
    } catch (error) {
      logger.error('Error updating template', { error: String(error) });
      next(new AppError('TEMPLATE_UPDATE_FAILED', 'Failed to update template', 500));
    }
  });

  // ========== WEB PUSH SUBSCRIPTION ROUTES ==========

  /**
   * GET /api/v1/notifications/vapid-public-key
   * Return the VAPID public key so the frontend can subscribe
   */
  router.get('/vapid-public-key', (req: Request, res: Response, next: NextFunction) => {
    const key = webPushService.getVapidPublicKey();
    if (!key) {
      return next(new AppError('WEB_PUSH_NOT_CONFIGURED', 'Web push not configured', 503));
    }
    res.json({ publicKey: key });
  });

  /**
   * POST /api/v1/notifications/subscribe
   * Store a browser push subscription for a user
   * Body: { userId, subscription: { endpoint, keys: { p256dh, auth } } }
   */
  router.post('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, subscription } = req.body;

      if (
        !userId ||
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      ) {
        return next(
          new AppError(
            'MISSING_FIELDS',
            'userId and subscription (with endpoint, keys.p256dh, keys.auth) are required',
            400
          )
        );
      }

      if (!webPushService.isEnabled()) {
        return next(
          new AppError('WEB_PUSH_NOT_CONFIGURED', 'Web push not configured on the server', 503)
        );
      }

      await webPushService.saveSubscription(userId, subscription);
      res.status(201).json({ message: 'Push subscription registered' });
    } catch (error) {
      logger.error('Error saving push subscription', { error: String(error) });
      next(new AppError('PUSH_SUBSCRIPTION_SAVE_FAILED', 'Failed to save push subscription', 500));
    }
  });

  /**
   * DELETE /api/v1/notifications/subscribe
   * Remove a browser push subscription
   * Body: { endpoint }
   */
  router.delete('/subscribe', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return next(new AppError('MISSING_FIELDS', 'endpoint is required', 400));
      }

      await webPushService.deleteSubscription(endpoint);
      res.json({ message: 'Push subscription removed' });
    } catch (error) {
      logger.error('Error removing push subscription', { error: String(error) });
      next(
        new AppError('PUSH_SUBSCRIPTION_REMOVE_FAILED', 'Failed to remove push subscription', 500)
      );
    }
  });

  // ========== HEALTH CHECK ==========

  /**
   * GET /api/v1/notifications/health
   * Check notification service health
   */
  router.get('/health', (req: Request, res: Response) => {
    const health = {
      status: 'ok',
      timestamp: new Date(),
      providers: {
        email: !!config.sendgrid.apiKey,
        push: pushNotificationService.getAvailableProviders(),
        webPush: webPushService.isEnabled(),
      },
    };

    res.json(health);
  });

  // ========== MOBILE DEVICE TOKEN ROUTES (Issue #1027) ==========

  router.post('/device-tokens', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, token, platform } = req.body as {
        userId?: string;
        token?: string;
        platform?: string;
      };
      if (!userId || !token || !platform) {
        return next(
          new AppError('MISSING_FIELDS', 'userId, token, and platform are required', 400)
        );
      }
      if (platform !== 'ios' && platform !== 'android') {
        return next(new AppError('INVALID_PLATFORM', 'platform must be ios or android', 400));
      }
      await deviceTokenService.registerToken(userId, token, platform);
      res.status(201).json({ message: 'Device token registered' });
    } catch (error) {
      logger.error('Error registering device token', { error: String(error) });
      next(new AppError('DEVICE_TOKEN_REGISTER_FAILED', 'Failed to register device token', 500));
    }
  });

  router.delete(
    '/device-tokens/:token',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { token } = req.params;
        await deviceTokenService.removeToken(token);
        res.status(204).end();
      } catch (error) {
        logger.error('Error removing device token', { error: String(error) });
        next(new AppError('DEVICE_TOKEN_REMOVE_FAILED', 'Failed to remove device token', 500));
      }
    }
  );

  return router;
}

export const notificationRouter = createNotificationRouter();
