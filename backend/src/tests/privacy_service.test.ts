jest.mock('../prisma_client', () => ({
  prisma: {
    analyticsEvent: { findMany: jest.fn(), deleteMany: jest.fn() },
    auditLog: { findMany: jest.fn(), deleteMany: jest.fn() },
    notificationPreference: { findFirst: jest.fn(), deleteMany: jest.fn() },
    notification: { findMany: jest.fn(), deleteMany: jest.fn() },
    notificationQueue: { findMany: jest.fn(), deleteMany: jest.fn() },
    pushSubscription: { findMany: jest.fn(), deleteMany: jest.fn() },
    webhook: { findMany: jest.fn(), deleteMany: jest.fn() },
    userMetrics: { findMany: jest.fn(), deleteMany: jest.fn() },
    memberReputation: { findUnique: jest.fn(), deleteMany: jest.fn() },
    privacyRequest: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
    refreshToken: { deleteMany: jest.fn() },
    $transaction: jest.fn(),
  },
}));

jest.mock('../logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../config', () => ({
  config: { privacy: { piiRetentionDays: 30 } },
}));

import { prisma } from '../prisma_client';
import { logger } from '../logger';
import {
  exportUserData,
  deleteUserData,
  createPrivacyRequest,
  completePrivacyRequest,
  enforceRetention,
} from '../privacy_service';

const db = prisma as unknown as {
  analyticsEvent: { findMany: jest.Mock; deleteMany: jest.Mock };
  auditLog: { findMany: jest.Mock; deleteMany: jest.Mock };
  notificationPreference: { findFirst: jest.Mock; deleteMany: jest.Mock };
  notification: { findMany: jest.Mock; deleteMany: jest.Mock };
  notificationQueue: { findMany: jest.Mock; deleteMany: jest.Mock };
  pushSubscription: { findMany: jest.Mock; deleteMany: jest.Mock };
  webhook: { findMany: jest.Mock; deleteMany: jest.Mock };
  userMetrics: { findMany: jest.Mock; deleteMany: jest.Mock };
  memberReputation: { findUnique: jest.Mock; deleteMany: jest.Mock };
  privacyRequest: { findMany: jest.Mock; create: jest.Mock; update: jest.Mock };
  refreshToken: { deleteMany: jest.Mock };
  $transaction: jest.Mock;
};

describe('privacy_service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('exportUserData', () => {
    it('gathers PII from every source table and redacts sensitive fields', async () => {
      db.analyticsEvent.findMany.mockResolvedValue([{ id: 'ae1' }]);
      db.auditLog.findMany.mockResolvedValue([{ id: 'al1' }]);
      db.notificationPreference.findFirst.mockResolvedValue({ id: 'np1' });
      db.notification.findMany.mockResolvedValue([{ id: 'n1' }]);
      db.notificationQueue.findMany.mockResolvedValue([{ id: 'nq1' }]);
      db.pushSubscription.findMany.mockResolvedValue([
        { id: 'ps1', p256dh: 'secret-key', auth: 'secret-auth' },
      ]);
      db.webhook.findMany.mockResolvedValue([{ id: 'w1', secret: 'webhook-secret' }]);
      db.userMetrics.findMany.mockResolvedValue([{ id: 'um1' }]);
      db.memberReputation.findUnique.mockResolvedValue({ id: 'mr1' });
      db.privacyRequest.findMany.mockResolvedValue([{ id: 'pr1' }]);

      const result = await exportUserData('GWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

      expect(result.walletAddress).toBe('GWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
      expect(result.pushSubscriptions).toEqual([{ id: 'ps1', p256dh: '[redacted]', auth: '[redacted]' }]);
      expect(result.webhooks).toEqual([{ id: 'w1', secret: '[redacted]' }]);
      expect(result.analyticsEvents).toEqual([{ id: 'ae1' }]);
      expect(typeof result.exportedAt).toBe('string');
    });
  });

  describe('deleteUserData', () => {
    it('deletes all PII in a single transaction and logs completion', async () => {
      db.$transaction.mockResolvedValue([]);

      await deleteUserData('GWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');

      expect(db.$transaction).toHaveBeenCalledTimes(1);
      const deletes = db.$transaction.mock.calls[0][0];
      expect(deletes).toHaveLength(10);
      expect(logger.info).toHaveBeenCalledWith(
        'User data deleted',
        { walletAddress: 'GWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' }
      );
    });
  });

  describe('createPrivacyRequest / completePrivacyRequest', () => {
    it('creates a privacy request with the given type', async () => {
      db.privacyRequest.create.mockResolvedValue({ id: 'pr1', requestType: 'export' });

      await createPrivacyRequest('GWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'export');

      expect(db.privacyRequest.create).toHaveBeenCalledWith({
        data: { walletAddress: 'GWALLETXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', requestType: 'export' },
      });
    });

    it('marks a privacy request completed with a completedAt timestamp', async () => {
      db.privacyRequest.update.mockResolvedValue({ id: 'pr1', status: 'completed' });

      await completePrivacyRequest('pr1', 'completed');

      const call = db.privacyRequest.update.mock.calls[0][0];
      expect(call.where).toEqual({ id: 'pr1' });
      expect(call.data.status).toBe('completed');
      expect(call.data.completedAt).toBeInstanceOf(Date);
    });
  });

  describe('enforceRetention', () => {
    it('purges records older than the configured retention window and returns counts', async () => {
      db.$transaction.mockResolvedValue([{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }]);
      db.refreshToken.deleteMany.mockResolvedValue({ count: 5 });

      const counts = await enforceRetention();

      expect(counts).toEqual({
        analyticsEvents: 1,
        auditLogs: 2,
        notifications: 3,
        notificationQueue: 4,
        expiredRefreshTokens: 5,
      });
      expect(logger.info).toHaveBeenCalledWith(
        'PII retention enforcement completed',
        expect.objectContaining({ counts })
      );
    });
  });
});
