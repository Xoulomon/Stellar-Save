import { Router } from 'express';

import { config } from '../config';
import { AppError } from '../lib/errors';
import { parsePagination, buildPaginatedResponse } from '../lib/pagination';
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
      const { userId, title, body, data } = req.body;

      if (!userId || !title || !body) {
        return next(new AppError('MISSING_FIELDS', 'userId, title, and body are required', 400));
      }

      const shouldSend = await UserPreferenceManager.shouldSendNotification(
        userId,
        'push',
        'push'
      );

      if (!shouldSend) {
        return next(
          new AppError(
            'PUSH_NOTIFICATIONS_DISABLED',
            'User has disabled push notifications',
            403
          )
        );
      }

      const result = await pushNotificationService.sendToUser(userId, { title, body, data });

      res.status(202).json({
        message: 'Push notification sent',
        result,
      });
    } catch (error) {
      logger.error('Error sending push notification', { error: String(error) });
      next(new AppError('PUSH_SEND_FAILED', 'Failed to send push notification', 500));
    }
  });

  /**
   * POST /api/v1/notifications/send-web-push
   * Send a web push notification
   */
  router.post('/send-web-push', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId, title, body, data } = req.body;

      if (!userId || !title || !body) {
        return next(new AppError('MISSING_FIELDS', 'userId, title, and body are required', 400));
      }

      const shouldSend = await UserPreferenceManager.shouldSendNotification(
        userId,
        'push',
        'web-push'
      );

      if (!shouldSend) {
        return next(
          new AppError(
            'PUSH_NOTIFICATIONS_DISABLED',
            'User has disabled push notifications',
            403
          )
        );
      }

      const result = await webPushService.sendToUser(userId, { title, body, data });

      res.status(202).json({
        message: 'Web push notification sent',
        result,
      });
    } catch (error) {
      logger.error('Error sending web push notification', { error: String(error) });
      next(new AppError('WEB_PUSH_SEND_FAILED', 'Failed to send web push notification', 500));
    }
  });

  // ========== TEMPLATE MANAGEMENT ROUTES ==========

  /**
   * GET /api/v1/notifications/templates
   * List all notification templates (paginated)
   */
  router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { page, pageSize, offset } = parsePagination(req.query);

      const allTemplates = await NotificationTemplateManager.getAllTemplates();
      const total = allTemplates.length;
      const templates = allTemplates.slice(offset, offset + pageSize);

      res.json(buildPaginatedResponse(templates, total, page, pageSize));
    } catch (error) {
      if (error instanceof AppError) {
        return next(error);
      }
      logger.error('Error fetching templates', { error: String(error) });
      next(new AppError('TEMPLATES_FETCH_FAILED', 'Failed to fetch templates', 500));
    }
  });

  /**
   * GET /api/v1/notifications/templates/:templateId
   * Get a specific notification template
   */
  router.get('/templates/:templateId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;

      const template = await NotificationTemplateManager.getTemplate(templateId);

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
   * Create a new notification template
   */
  router.post('/templates', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, name, subject, body, type } = req.body;

      if (!id || !name || !body || !type) {
        return next(new AppError('MISSING_FIELDS', 'id, name, body, and type are required', 400));
      }

      const template = await NotificationTemplateManager.createTemplate({
        id,
        name,
        subject,
        body,
        type,
      });

      res.status(201).json(template);
    } catch (error) {
      logger.error('Error creating template', { error: String(error) });
      next(new AppError('TEMPLATE_CREATE_FAILED', 'Failed to create template', 500));
    }
  });

  /**
   * PUT /api/v1/notifications/templates/:templateId
   * Update a notification template
   */
  router.put('/templates/:templateId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { templateId } = req.params;
      const updates = req.body;

      const template = await NotificationTemplateManager.updateTemplate(templateId, updates);

      res.json(template);
    } catch (error) {
      logger.error('Error updating template', { error: String(error) });
      next(new AppError('TEMPLATE_UPDATE_FAILED', 'Failed to update template', 500));
    }
  });

  /**
   * DELETE /api/v1/notifications/templates/:templateId
   * Delete a notification template
   */
  router.delete(
    '/templates/:templateId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { templateId } = req.params;

        await NotificationTemplateManager.deleteTemplate(templateId);

        res.json({ message: 'Template deleted' });
      } catch (error) {
        logger.error('Error deleting template', { error: String(error) });
        next(new AppError('TEMPLATE_DELETE_FAILED', 'Failed to delete template', 500));
      }
    }
  );

  return router;
}
