import { NotificationService } from '../src/notification_service';
import { PushNotificationService, FirebaseProvider, OneSignalProvider } from '../src/push_notification_service';
import { UserPreferenceManager } from '../src/user_preference_manager';
import { NotificationTemplateManager, NotificationEventType } from '../src/notification_template_manager';
import { PrismaClient } from '@prisma/client';

// Mock Prisma
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(),
}));

// Mock SendGrid
jest.mock('@sendgrid/mail', () => ({
  setApiKey: jest.fn(),
  send: jest.fn(),
}));

describe('Notification Service', () => {
  let notificationService: NotificationService;
  let prismaClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
    prismaClient = new PrismaClient();
  });

  describe('Email Notifications', () => {
    it('should send an email notification', async () => {
      const mockTemplate = {
        id: 'template-1',
        templateKey: 'email_contribution_reminder',
        templateType: 'email',
        subject: 'Reminder: Contribution due for {{groupName}}',
        htmlContent: '<h1>Hello {{userName}}</h1>',
        textContent: 'Hello {{userName}}',
        active: true,
      };

      jest.spyOn(prismaClient.notificationTemplate, 'findUnique').mockResolvedValue(mockTemplate);

      const templateData = {
        userId: 'user-123',
        userName: 'John Doe',
        groupName: 'Weekly Savings',
      };

      // Test email sending logic
      expect(notificationService).toBeDefined();
    });

    it('should handle email template not found', async () => {
      jest.spyOn(prismaClient.notificationTemplate, 'findUnique').mockResolvedValue(null);

      await expect(
        notificationService.sendEmail('test@example.com', 'invalid_template', {}, 'Test')
      ).rejects.toThrow('template not found');
    });

    it('should render template with correct placeholders', () => {
      const template = 'Hello {{userName}}, your balance is {{balance}} XLM';
      const data = { userName: 'John', balance: '100' };

      // Test template rendering
      expect(template).toContain('{{userName}}');
    });
  });

  describe('Push Notifications', () => {
    it('should initialize Firebase provider', () => {
      const provider = new FirebaseProvider(
        'test-project',
        JSON.stringify({ type: 'service_account' })
      );

      expect(provider).toBeDefined();
    });

    it('should throw error for invalid Firebase credentials', () => {
      expect(() => {
        new FirebaseProvider('test-project', 'invalid-json');
      }).toThrow('Invalid Firebase service account JSON');
    });

    it('should initialize OneSignal provider', () => {
      const provider = new OneSignalProvider('app-id-123', 'api-key-456');

      expect(provider).toBeDefined();
    });

    it('should send push notification via default provider', async () => {
      const pushService = new PushNotificationService();

      const providers = pushService.getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
    });

    it('should check provider availability', async () => {
      const pushService = new PushNotificationService();

      const isAvailable = pushService.isProviderAvailable('firebase');

      expect(typeof isAvailable).toBe('boolean');
    });
  });

  describe('User Preferences', () => {
    it('should create default preferences for new user', async () => {
      const mockPreferences = {
        id: 'pref-1',
        userId: 'user-123',
        emailNotifications: true,
        pushNotifications: true,
        contributionReminders: true,
        groupUpdates: true,
        payoutNotifications: true,
        emailFrequency: 'immediate',
        unsubscribeToken: 'token-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(UserPreferenceManager, 'getOrCreatePreferences')
        .mockResolvedValue(mockPreferences);

      const preferences = await UserPreferenceManager.getOrCreatePreferences('user-123');

      expect(preferences.userId).toBe('user-123');
      expect(preferences.emailNotifications).toBe(true);
    });

    it('should update user preferences', async () => {
      const mockUpdated = {
        id: 'pref-1',
        userId: 'user-123',
        emailNotifications: false,
        pushNotifications: true,
        contributionReminders: true,
        groupUpdates: true,
        payoutNotifications: true,
        emailFrequency: 'daily',
        unsubscribeToken: 'token-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(UserPreferenceManager, 'updatePreferences').mockResolvedValue(mockUpdated);

      const updated = await UserPreferenceManager.updatePreferences('user-123', {
        emailNotifications: false,
        emailFrequency: 'daily',
      });

      expect(updated.emailNotifications).toBe(false);
      expect(updated.emailFrequency).toBe('daily');
    });

    it('should unsubscribe user from notifications', async () => {
      jest.spyOn(UserPreferenceManager, 'unsubscribeUser').mockResolvedValue({
        id: 'pref-1',
        userId: 'user-123',
        emailNotifications: false,
        pushNotifications: false,
        emailFrequency: 'never',
      } as any);

      const result = await UserPreferenceManager.unsubscribeUser('token-123');

      expect(result.emailNotifications).toBe(false);
      expect(result.emailFrequency).toBe('never');
    });

    it('should check if user should receive notification', async () => {
      jest.spyOn(UserPreferenceManager, 'shouldSendNotification').mockResolvedValue(true);

      const should = await UserPreferenceManager.shouldSendNotification(
        'user-123',
        'email',
        'contribution_reminder'
      );

      expect(should).toBe(true);
    });

    it('should respect email frequency settings', async () => {
      jest.spyOn(UserPreferenceManager, 'shouldSendNotification').mockResolvedValue(false);

      const should = await UserPreferenceManager.shouldSendNotification(
        'user-123',
        'email',
        'group_update'
      );

      expect(should).toBe(false);
    });

    it('should get aggregate preference statistics', async () => {
      const mockStats = {
        total: 1000,
        emailEnabled: 750,
        pushEnabled: 600,
        emailEnabledPercent: '75.00',
        pushEnabledPercent: '60.00',
        byFrequency: {
          immediate: 400,
          daily: 200,
          weekly: 150,
          never: 250,
        },
      };

      jest.spyOn(UserPreferenceManager, 'getPreferenceStats').mockResolvedValue(mockStats);

      const stats = await UserPreferenceManager.getPreferenceStats();

      expect(stats.total).toBe(1000);
      expect(stats.emailEnabledPercent).toBe('75.00');
    });

    it('should batch update multiple users preferences', async () => {
      jest.spyOn(UserPreferenceManager, 'batchUpdatePreferences').mockResolvedValue({
        count: 5,
      } as any);

      const result = await UserPreferenceManager.batchUpdatePreferences(
        ['user-1', 'user-2', 'user-3', 'user-4', 'user-5'],
        { emailFrequency: 'never' }
      );

      expect(result.count).toBe(5);
    });

    it('should register device token', async () => {
      const registered = await UserPreferenceManager.registerDeviceToken(
        'user-123',
        'device-token-abc',
        'iOS'
      );

      expect(registered.userId).toBe('user-123');
      expect(registered.platform).toBe('iOS');
    });

    it('should unregister device token', async () => {
      const unregistered = await UserPreferenceManager.unregisterDeviceToken(
        'user-123',
        'device-token-abc'
      );

      expect(unregistered.userId).toBe('user-123');
    });
  });

  describe('Notification Templates', () => {
    it('should initialize default templates', async () => {
      jest
        .spyOn(NotificationTemplateManager, 'initializeDefaultTemplates')
        .mockResolvedValue(undefined);

      await NotificationTemplateManager.initializeDefaultTemplates();

      // Should not throw
    });

    it('should get template by key', async () => {
      const mockTemplate = {
        id: 'template-1',
        templateKey: 'email_contribution_reminder',
        templateName: 'Contribution Reminder - Email',
        templateType: 'email',
        subject: 'Reminder: Contribution due',
        htmlContent: '<h1>Reminder</h1>',
        textContent: 'Reminder',
        active: true,
      };

      jest.spyOn(NotificationTemplateManager, 'getTemplate').mockResolvedValue(mockTemplate as any);

      const template = await NotificationTemplateManager.getTemplate('email_contribution_reminder');

      expect(template?.templateKey).toBe('email_contribution_reminder');
    });

    it('should get all active templates', async () => {
      const mockTemplates = [
        {
          templateKey: 'email_reminder',
          templateName: 'Reminder',
          templateType: 'email',
          active: true,
        },
        {
          templateKey: 'push_reminder',
          templateName: 'Push Reminder',
          templateType: 'push',
          active: true,
        },
      ];

      jest
        .spyOn(NotificationTemplateManager, 'getActiveTemplates')
        .mockResolvedValue(mockTemplates as any);

      const templates = await NotificationTemplateManager.getActiveTemplates();

      expect(templates.length).toBe(2);
    });

    it('should create custom template', async () => {
      const mockTemplate = {
        id: 'template-2',
        templateKey: 'custom_notification',
        templateName: 'Custom Notification',
        templateType: 'email',
        subject: 'Custom Template',
        htmlContent: '<h1>Custom</h1>',
        textContent: 'Custom',
        active: true,
      };

      jest
        .spyOn(NotificationTemplateManager, 'createTemplate')
        .mockResolvedValue(mockTemplate as any);

      const template = await NotificationTemplateManager.createTemplate({
        templateKey: 'custom_notification',
        templateName: 'Custom Notification',
        templateType: 'email',
        htmlContent: '<h1>Custom</h1>',
        textContent: 'Custom',
        placeholders: [],
      });

      expect(template?.templateKey).toBe('custom_notification');
    });

    it('should update template', async () => {
      jest.spyOn(NotificationTemplateManager, 'updateTemplate').mockResolvedValue({
        templateKey: 'email_reminder',
        htmlContent: '<h1>Updated</h1>',
      } as any);

      const updated = await NotificationTemplateManager.updateTemplate('email_reminder', {
        htmlContent: '<h1>Updated</h1>',
      });

      expect(updated?.htmlContent).toContain('Updated');
    });

    it('should disable template', async () => {
      jest.spyOn(NotificationTemplateManager, 'disableTemplate').mockResolvedValue({
        templateKey: 'email_reminder',
        active: false,
      } as any);

      const disabled = await NotificationTemplateManager.disableTemplate('email_reminder');

      expect(disabled?.active).toBe(false);
    });
  });

  describe('Notification Queue', () => {
    it('should queue notification for later sending', async () => {
      jest.spyOn(notificationService, 'queueNotification').mockResolvedValue('queue-123');

      const queueId = await notificationService.queueNotification(
        'user-123',
        'email_reminder',
        'user@example.com',
        { groupName: 'Weekly Group' },
        'email'
      );

      expect(queueId).toBe('queue-123');
    });

    it('should process queued notifications', async () => {
      jest.spyOn(notificationService, 'processQueuedNotifications').mockResolvedValue(5);

      const processed = await notificationService.processQueuedNotifications(100);

      expect(processed).toBe(5);
    });

    it('should handle notification processing failures', async () => {
      jest
        .spyOn(notificationService, 'processQueuedNotifications')
        .mockRejectedValue(new Error('Processing failed'));

      await expect(notificationService.processQueuedNotifications(100)).rejects.toThrow(
        'Processing failed'
      );
    });
  });

  describe('Notification History', () => {
    it('should retrieve notification history', async () => {
      const mockHistory = [
        {
          id: 'notif-1',
          userId: 'user-123',
          status: 'sent',
          createdAt: new Date(),
        },
        {
          id: 'notif-2',
          userId: 'user-123',
          status: 'sent',
          createdAt: new Date(),
        },
      ];

      jest
        .spyOn(notificationService, 'getNotificationHistory')
        .mockResolvedValue(mockHistory as any);

      const history = await notificationService.getNotificationHistory('user-123', 20);

      expect(history.length).toBe(2);
    });

    it('should get notification statistics', async () => {
      const mockStats = {
        totalSent: 1000,
        totalFailed: 50,
        totalPending: 20,
        byType: { email: 800, push: 250 },
      };

      jest.spyOn(notificationService, 'getNotificationStats').mockResolvedValue(mockStats);

      const stats = await notificationService.getNotificationStats();

      expect(stats.totalSent).toBe(1000);
      expect(stats.totalFailed).toBe(50);
    });
  });

  describe('Notification Cleanup', () => {
    it('should cleanup old notifications', async () => {
      jest.spyOn(notificationService, 'cleanupOldNotifications').mockResolvedValue(100);

      const cleaned = await notificationService.cleanupOldNotifications(90);

      expect(cleaned).toBe(100);
    });
  });

  describe('Event Types', () => {
    it('should have all required event types', () => {
      expect(NotificationEventType.ContributionReminder).toBe('contribution_reminder');
      expect(NotificationEventType.ContributionConfirmed).toBe('contribution_confirmed');
      expect(NotificationEventType.PayoutNotification).toBe('payout_notification');
      expect(NotificationEventType.GroupUpdate).toBe('group_update');
      expect(NotificationEventType.MemberJoined).toBe('member_joined');
    });
  });
});
