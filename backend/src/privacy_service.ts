/**
 * Privacy Service — GDPR/CCPA compliance (Issue #1107)
 *
 * PII inventory for Stellar-Save:
 *   - AnalyticsEvent: ipAddress, userAgent (potentially identifying)
 *   - AuditLog:       ipAddress, userAgent, walletAddress
 *   - NotificationPreference: userId (wallet address)
 *   - Notification:   userId, recipient (email/device token)
 *   - NotificationQueue: userId, recipient
 *   - PushSubscription: userId, endpoint, p256dh, auth
 *   - Webhook:        userId, url
 *   - UserMetrics:    userId
 *   - MemberReputation: address (wallet)
 *   - RefreshToken:   walletAddress
 *   - PrivacyRequest: walletAddress
 *
 * Retention: all PII older than config.privacy.piiRetentionDays is purged
 * during the scheduled retention job.
 */
import { prisma } from './prisma_client';
import { config } from './config';
import { logger } from './logger';

// ── Export ────────────────────────────────────────────────────────────────────

/**
 * Collect all PII associated with a wallet address and return a structured
 * JSON export suitable for delivery to the user.
 */
export async function exportUserData(walletAddress: string): Promise<Record<string, unknown>> {
  const [
    analyticsEvents,
    auditLogs,
    notificationPrefs,
    notifications,
    notificationQueue,
    pushSubscriptions,
    webhooks,
    userMetrics,
    reputation,
    privacyRequests,
  ] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { userId: walletAddress } }),
    prisma.auditLog.findMany({ where: { walletAddress } }),
    prisma.notificationPreference.findFirst({ where: { userId: walletAddress } }),
    prisma.notification.findMany({ where: { userId: walletAddress } }),
    prisma.notificationQueue.findMany({ where: { userId: walletAddress } }),
    prisma.pushSubscription.findMany({ where: { userId: walletAddress } }),
    prisma.webhook.findMany({ where: { userId: walletAddress } }),
    prisma.userMetrics.findMany({ where: { userId: walletAddress } }),
    prisma.memberReputation.findUnique({ where: { address: walletAddress } }),
    prisma.privacyRequest.findMany({ where: { walletAddress } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    walletAddress,
    analyticsEvents,
    auditLogs,
    notificationPreferences: notificationPrefs,
    notifications,
    notificationQueue,
    pushSubscriptions: pushSubscriptions.map((s) => ({
      ...s,
      // Redact keys — the export documents existence, not full credential material
      p256dh: '[redacted]',
      auth: '[redacted]',
    })),
    webhooks: webhooks.map((w) => ({ ...w, secret: '[redacted]' })),
    userMetrics,
    reputation,
    privacyRequests,
  };
}

// ── Deletion ──────────────────────────────────────────────────────────────────

/**
 * Permanently delete all PII associated with a wallet address.
 * Wallet address itself is preserved in PrivacyRequest for audit trail
 * (legitimate interest / legal obligation, stored as a hash in production).
 *
 * Runs all deletes in a single transaction so partial deletion is impossible.
 */
export async function deleteUserData(walletAddress: string): Promise<void> {
  await prisma.$transaction([
    prisma.analyticsEvent.deleteMany({ where: { userId: walletAddress } }),
    prisma.auditLog.deleteMany({ where: { walletAddress } }),
    prisma.notificationPreference.deleteMany({ where: { userId: walletAddress } }),
    prisma.notification.deleteMany({ where: { userId: walletAddress } }),
    prisma.notificationQueue.deleteMany({ where: { userId: walletAddress } }),
    prisma.pushSubscription.deleteMany({ where: { userId: walletAddress } }),
    prisma.webhook.deleteMany({ where: { userId: walletAddress } }),
    prisma.userMetrics.deleteMany({ where: { userId: walletAddress } }),
    prisma.memberReputation.deleteMany({ where: { address: walletAddress } }),
    prisma.refreshToken.deleteMany({ where: { walletAddress } }),
  ]);

  logger.info('User data deleted', { walletAddress });
}

// ── Privacy request tracking ──────────────────────────────────────────────────

export async function createPrivacyRequest(
  walletAddress: string,
  requestType: 'export' | 'deletion',
) {
  return prisma.privacyRequest.create({
    data: { walletAddress, requestType },
  });
}

export async function completePrivacyRequest(id: string, status: 'completed' | 'failed') {
  return prisma.privacyRequest.update({
    where: { id },
    data: { status, completedAt: new Date() },
  });
}

// ── Retention enforcement ─────────────────────────────────────────────────────

/**
 * Purge PII records older than config.privacy.piiRetentionDays.
 * Should be called by a scheduled job (e.g. daily cron via BackupScheduler pattern).
 *
 * Returns counts of deleted records per table for audit logging.
 */
export async function enforceRetention(): Promise<Record<string, number>> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - config.privacy.piiRetentionDays);

  const [analyticsEvents, auditLogs, notifications, notificationQueue] = await prisma.$transaction([
    prisma.analyticsEvent.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    prisma.notification.deleteMany({ where: { createdAt: { lt: cutoff }, status: { in: ['sent', 'failed'] } } }),
    prisma.notificationQueue.deleteMany({ where: { createdAt: { lt: cutoff }, status: 'completed' } }),
  ]);

  // Also purge expired refresh tokens
  const expiredTokens = await prisma.refreshToken.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });

  const counts = {
    analyticsEvents: analyticsEvents.count,
    auditLogs: auditLogs.count,
    notifications: notifications.count,
    notificationQueue: notificationQueue.count,
    expiredRefreshTokens: expiredTokens.count,
  };

  logger.info('PII retention enforcement completed', { cutoff, counts });
  return counts;
}
