import { Router, Request, Response } from 'express';
import { NotificationService } from '../notification_service';
import { PushNotificationService } from '../push_notification_service';
import { UserPreferenceManager } from '../user_preference_manager';
import { NotificationTemplateManager } from '../notification_template_manager';
import { logger } from '../logger';

/**
 * Notification Service Routes
 * Endpoints for managing notifications, preferences, and templates
 */
export function createNotificationRouter(): Router {
  const router = Router();
  const notificationService = new NotificationService();
  const pushNotificationService = new PushNotificationService();

  // ========== PREFERENCE MANAGEMENT ROUTES ==========

  /**
   * GET /api/v1/notifications/preferences/:userId
   * Get user's notification preferences
   */
  router.get('/preferences/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const preferences = await UserPreferenceManager.getOrCreatePreferences(userId);
      res.json(preferences);
    } catch (error) {
      logger.error('Error fetching preferences', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch preferences' });
    }
  });

  /**
   * PUT /api/v1/notifications/preferences/:userId
   * Update user's notification preferences
   */
  router.put('/preferences/:userId', async (req: Request, res: Response) => {
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
        return res.status(400).json({ error: 'Invalid emailFrequency' });
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
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  });

  /**
   * GET /api/v1/notifications/preferences/stats
   * Get aggregate preference statistics
   */
  router.get('/preferences/stats', async (req: Request, res: Response) => {
    try {
      const stats = await UserPreferenceManager.getPreferenceStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error fetching preference stats', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  /**
   * POST /api/v1/notifications/device-token
   * Register device token for push notifications
   */
  router.post('/device-token', async (req: Request, res: Response) => {
    try {
      const { userId, deviceToken, platform } = req.body;

      if (!userId || !deviceToken || !platform) {
        return res.status(400).json({ error: 'userId, deviceToken, and platform are required' });
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
      res.status(500).json({ error: 'Failed to register device token' });
    }
  });

  /**
   * DELETE /api/v1/notifications/device-token/:userId/:deviceToken
   * Unregister device token
   */
  router.delete('/device-token/:userId/:deviceToken', async (req: Request, res: Response) => {
    try {
      const { userId, deviceToken } = req.params;

      const unregistered = await UserPreferenceManager.unregisterDeviceToken(userId, deviceToken);

      res.json({
        message: 'Device token unregistered',
        data: unregistered,
      });
    } catch (error) {
      logger.error('Error unregistering device token', { error: String(error) });
      res.status(500).json({ error: 'Failed to unregister device token' });
    }
  });

  // ========== UNSUBSCRIBE ROUTES ==========

  /**
   * POST /api/v1/notifications/unsubscribe/:token
   * Unsubscribe user via token (one-click unsubscribe)
   */
  router.post('/unsubscribe/:token', async (req: Request, res: Response) => {
    try {
      const { token } = req.params;

      await UserPreferenceManager.unsubscribeUser(token);

      // Return HTML for email link
      res.send(`
        <html>
          <body>
            <h1>Unsubscribed</h1>
            <p>You have been unsubscribed from all notifications.</p>
            <p><a href="${process.env.FRONTEND_URL || 'https://stellar-save.com'}">Return to Stellar-Save</a></p>
          </body>
        </html>
      `);
    } catch (error) {
      logger.error('Error unsubscribing user', { error: String(error) });
      res.status(400).json({ error: 'Invalid unsubscribe token' });
    }
  });

  /**
   * POST /api/v1/notifications/resubscribe/:userId
   * Re-subscribe user to notifications
   */
  router.post('/resubscribe/:userId', async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const updated = await UserPreferenceManager.resubscribeUser(userId);

      res.json({
        message: 'User resubscribed to notifications',
        preferences: updated,
      });
    } catch (error) {
      logger.error('Error resubscribing user', { error: String(error) });
      res.status(500).json({ error: 'Failed to resubscribe user' });
    }
  });

  // ========== NOTIFICATION SENDING ROUTES ==========

  /**
   * POST /api/v1/notifications/send-email
   * Send an email notification
   */
  router.post('/send-email', async (req: Request, res: Response) => {
    try {
      const { userId, to, templateId, templateData, subject } = req.body;

      if (!to || !templateId || !templateData) {
        return res.status(400).json({ error: 'to, templateId, and templateData are required' });
      }

      // Check preferences
      if (userId) {
        const shouldSend = await UserPreferenceManager.shouldSendNotification(
          userId,
          'email',
          templateId
        );

        if (!shouldSend) {
          return res.status(403).json({
            error: 'User has disabled email notifications for this type',
          });
        }
      }

      const messageId = await notificationService.sendEmail(to, templateId, templateData, subject);

      res.status(202).json({
        message: 'Email notification sent',
        messageId,
      });
    } catch (error) {
      logger.error('Error sending email', { error: String(error) });
      res.status(500).json({ error: 'Failed to send email notification' });
    }
  });

  /**
   * POST /api/v1/notifications/send-push
   * Send a push notification
   */
  router.post('/send-push', async (req: Request, res: Response) => {
    try {
      const { userId, deviceToken, templateId, templateData, title, body } = req.body;

      if (!deviceToken || !templateId || !templateData) {
        return res.status(400).json({
          error: 'deviceToken, templateId, and templateData are required',
        });
      }

      // Check preferences
      if (userId) {
        const shouldSend = await UserPreferenceManager.shouldSendNotification(
          userId,
          'push',
          templateId
        );

        if (!shouldSend) {
          return res.status(403).json({
            error: 'User has disabled push notifications for this type',
          });
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
      res.status(500).json({ error: 'Failed to send push notification' });
    }
  });

  /**
   * POST /api/v1/notifications/queue
   * Queue a notification for later sending
   */
  router.post('/queue', async (req: Request, res: Response) => {
    try {
      const { userId, templateKey, recipient, templateData, notificationType, priority, scheduledFor } =
        req.body;

      if (!userId || !templateKey || !recipient || !templateData || !notificationType) {
        return res.status(400).json({
          error: 'userId, templateKey, recipient, templateData, and notificationType are required',
        });
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
      res.status(500).json({ error: 'Failed to queue notification' });
    }
  });

  /**
   * POST /api/v1/notifications/process-queue
   * Process queued notifications
   */
  router.post('/process-queue', async (req: Request, res: Response) => {
    try {
      const batchSize = req.body.batchSize || 100;

      const processed = await notificationService.processQueuedNotifications(batchSize);

      res.json({
        message: 'Queue processed',
        processedCount: processed,
      });
    } catch (error) {
      logger.error('Error processing queue', { error: String(error) });
      res.status(500).json({ error: 'Failed to process queue' });
    }
  });

  // ========== NOTIFICATION HISTORY ROUTES ==========

  /**
   * GET /api/v1/notifications/history/:userId
   * Get notification history for a user
   */
  router.get('/history/:userId', async (req: Request, res: Response) => {
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
      res.status(500).json({ error: 'Failed to fetch notification history' });
    }
  });

  /**
   * GET /api/v1/notifications/stats
   * Get notification service statistics
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const stats = await notificationService.getNotificationStats();

      res.json({
        timestamp: new Date(),
        stats,
      });
    } catch (error) {
      logger.error('Error fetching notification stats', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  // ========== TEMPLATE MANAGEMENT ROUTES ==========

  /**
   * GET /api/v1/notifications/templates
   * Get all active templates
   */
  router.get('/templates', async (req: Request, res: Response) => {
    try {
      const templates = await NotificationTemplateManager.getActiveTemplates();

      res.json({
        count: templates.length,
        templates,
      });
    } catch (error) {
      logger.error('Error fetching templates', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch templates' });
    }
  });

  /**
   * GET /api/v1/notifications/templates/:templateKey
   * Get a specific template
   */
  router.get('/templates/:templateKey', async (req: Request, res: Response) => {
    try {
      const { templateKey } = req.params;

      const template = await NotificationTemplateManager.getTemplate(templateKey);

      if (!template) {
        return res.status(404).json({ error: 'Template not found' });
      }

      res.json(template);
    } catch (error) {
      logger.error('Error fetching template', { error: String(error) });
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  /**
   * POST /api/v1/notifications/templates
   * Create a new template (admin only)
   */
  router.post('/templates', async (req: Request, res: Response) => {
    try {
      const { templateKey, templateName, templateType, subject, htmlContent, textContent, placeholders } =
        req.body;

      if (!templateKey || !templateName || !templateType || !htmlContent || !textContent) {
        return res.status(400).json({
          error: 'templateKey, templateName, templateType, htmlContent, and textContent are required',
        });
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
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  /**
   * PUT /api/v1/notifications/templates/:templateKey
   * Update a template (admin only)
   */
  router.put('/templates/:templateKey', async (req: Request, res: Response) => {
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
      res.status(500).json({ error: 'Failed to update template' });
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
        email: !!process.env.SENDGRID_API_KEY,
        push: pushNotificationService.getAvailableProviders(),
      },
    };

    res.json(health);
  });

  return router;
}

export const notificationRouter = createNotificationRouter();
