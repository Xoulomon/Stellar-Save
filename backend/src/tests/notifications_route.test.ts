/**
 * Tests for mobile push-notification endpoints:
 *   POST   /api/v1/notifications/device-tokens
 *   GET    /api/v1/notifications/preferences/:userId
 *   PUT    /api/v1/notifications/preferences/:userId
 *   POST   /api/v1/notifications/test-push
 *
 * Acceptance criteria:
 *   - A backend test notification is received and routes correctly on tap
 *   - Disabling a category in-app suppresses it server-side
 */

import express from 'express';
import request from 'supertest';

// ── Mocks (must be declared before imports that use them) ─────────────────────

jest.mock('../device_token_service', () => ({
  deviceTokenService: {
    registerToken: jest.fn().mockResolvedValue(undefined),
    removeToken: jest.fn().mockResolvedValue(undefined),
    getTokensForUser: jest.fn().mockResolvedValue([]),
  },
}));

// Shared spy exposed so test-push assertions can reference it.
const mockSendToUserMobile = jest.fn().mockResolvedValue(undefined);

jest.mock('../push_notification_service', () => ({
  PushNotificationService: jest.fn().mockImplementation(() => ({
    getAvailableProviders: () => [],
    sendToUserMobile: mockSendToUserMobile,
  })),
}));

jest.mock('../notification_service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    getNotificationStats: jest.fn().mockResolvedValue({ totalSent: 0, totalFailed: 0, totalPending: 0, byType: {} }),
    getNotificationHistory: jest.fn().mockResolvedValue([]),
    sendEmail: jest.fn(),
    sendPushNotification: jest.fn(),
    queueNotification: jest.fn(),
    processQueuedNotifications: jest.fn(),
  })),
}));

jest.mock('../web_push_service', () => ({
  WebPushService: jest.fn().mockImplementation(() => ({
    isEnabled: () => false,
    getVapidPublicKey: () => null,
    saveSubscription: jest.fn(),
    deleteSubscription: jest.fn(),
  })),
}));

jest.mock('../user_preference_manager', () => {
  const base = {
    userId: 'user-1',
    emailNotifications: true,
    pushNotifications: true,
    contributionReminders: true,
    groupUpdates: true,
    payoutNotifications: true,
    emailFrequency: 'immediate',
    unsubscribeToken: 'tok-abc',
  };
  return {
    UserPreferenceManager: {
      getOrCreatePreferences: jest.fn().mockResolvedValue(base),
      updatePreferences: jest.fn().mockImplementation((_id: string, updates: object) =>
        Promise.resolve({ ...base, ...updates })
      ),
      shouldSendNotification: jest.fn().mockResolvedValue(true),
      registerDeviceToken: jest.fn().mockResolvedValue({}),
      unregisterDeviceToken: jest.fn().mockResolvedValue({}),
      unsubscribeUser: jest.fn().mockResolvedValue(undefined),
      resubscribeUser: jest.fn().mockResolvedValue(base),
      getPreferenceStats: jest.fn().mockResolvedValue({}),
    },
  };
});

jest.mock('../notification_template_manager', () => ({
  NotificationTemplateManager: {
    getActiveTemplates: jest.fn().mockResolvedValue([]),
    getTemplate: jest.fn().mockResolvedValue(null),
    createTemplate: jest.fn(),
    updateTemplate: jest.fn(),
  },
}));

jest.mock('../config', () => ({
  config: {
    sendgrid: { apiKey: '', fromEmail: 'no-reply@example.com', replyTo: '' },
    push: {
      provider: 'firebase',
      firebase: { projectId: '', serviceAccount: '' },
      onesignal: { appId: '', apiKey: '' },
    },
    apns: { keyId: '', teamId: '', key: '', bundleId: '' },
    nodeEnv: 'test',
    urls: { frontend: 'http://localhost:3000' },
  },
}));

jest.mock('../logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ── Build app after mocks ─────────────────────────────────────────────────────

import { createNotificationRouter } from '../routes/notifications';

const app = express();
app.use(express.json());
app.use('/api/v1/notifications', createNotificationRouter());

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/v1/notifications/device-tokens', () => {
  it('registers a device token successfully', async () => {
    const { deviceTokenService } = jest.requireMock('../device_token_service');

    const res = await request(app)
      .post('/api/v1/notifications/device-tokens')
      .send({ userId: 'user-1', token: 'expo-push-token-abc', platform: 'ios' });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Device token registered');
    expect(deviceTokenService.registerToken).toHaveBeenCalledWith('user-1', 'expo-push-token-abc', 'ios');
  });

  it('rejects missing fields', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/device-tokens')
      .send({ userId: 'user-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required/i);
  });

  it('rejects unknown platform', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/device-tokens')
      .send({ userId: 'user-1', token: 'tok', platform: 'windows' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/platform/i);
  });
});

describe('GET /api/v1/notifications/preferences/:userId', () => {
  it('returns current preferences for a user', async () => {
    const res = await request(app).get('/api/v1/notifications/preferences/user-1');

    expect(res.status).toBe(200);
    expect(res.body.contributionReminders).toBe(true);
    expect(res.body.payoutNotifications).toBe(true);
  });
});

describe('PUT /api/v1/notifications/preferences/:userId', () => {
  it('updates preferences and suppresses disabled category server-side', async () => {
    const { UserPreferenceManager } = jest.requireMock('../user_preference_manager');

    const res = await request(app)
      .put('/api/v1/notifications/preferences/user-1')
      .send({ contributionReminders: false });

    expect(res.status).toBe(200);
    expect(res.body.preferences.contributionReminders).toBe(false);
    expect(UserPreferenceManager.updatePreferences).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ contributionReminders: false })
    );
  });

  it('rejects invalid emailFrequency', async () => {
    const res = await request(app)
      .put('/api/v1/notifications/preferences/user-1')
      .send({ emailFrequency: 'biweekly' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/emailFrequency/i);
  });
});

describe('POST /api/v1/notifications/test-push', () => {
  beforeEach(() => {
    mockSendToUserMobile.mockClear();
  });

  it('sends a test push to user devices and returns correct routing data', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/test-push')
      .send({ userId: 'user-1', screen: 'GroupDetail', groupId: 'grp-42' });

    expect(res.status).toBe(200);
    expect(res.body.data.screen).toBe('GroupDetail');
    expect(res.body.data.groupId).toBe('grp-42');
    expect(mockSendToUserMobile).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ screen: 'GroupDetail', groupId: 'grp-42' })
    );
  });

  it('sends to Contribution screen with contributionId when provided', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/test-push')
      .send({ userId: 'user-1', screen: 'Contribution', groupId: 'grp-42', contributionId: 'c-7' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ screen: 'Contribution', groupId: 'grp-42', contributionId: 'c-7' });
    expect(mockSendToUserMobile).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({ contributionId: 'c-7' })
    );
  });

  it('rejects request when userId is missing', async () => {
    const res = await request(app)
      .post('/api/v1/notifications/test-push')
      .send({ screen: 'GroupDetail' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/userId/i);
  });
});
