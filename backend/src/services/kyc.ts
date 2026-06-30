/**
 * KYC verification service (Issue #1024).
 *
 * Integrates with a SEP-12 compatible KYC provider.
 * Raw identity documents are never stored — only status transitions are persisted.
 */

import * as crypto from 'crypto';
import { logger } from '../logger';
import { prisma } from '../prisma_client';
import { config } from '../config';

export type KycStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface KycSubmitOpts {
  userId: string;
  walletAddress: string;
  fields: Record<string, string>; // e.g. { first_name, last_name, email_address, ... }
}

export interface KycStatusResult {
  userId: string;
  status: KycStatus;
  kycId?: string;
  submittedAt?: string;
  reviewedAt?: string;
}

export async function submitKyc(opts: KycSubmitOpts): Promise<KycStatusResult> {
  const { userId, walletAddress, fields } = opts;
  const providerUrl = (config as any).kyc?.providerUrl ?? process.env['KYC_PROVIDER_URL'] ?? 'https://sandbox.kyc-provider.example.com';

  // POST to provider — only send fields, never store raw docs locally
  const res = await fetch(`${providerUrl}/kyc`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ account: walletAddress, fields }),
  });

  let kycProviderId: string | undefined;
  if (res.ok) {
    const body = (await res.json()) as { id?: string };
    kycProviderId = body.id;
  } else {
    logger.warn('[kyc] provider returned non-ok status', { status: res.status, userId });
  }

  const record = await (prisma as any).kycRecord.upsert({
    where: { userId },
    create: { userId, walletAddress, status: 'pending', kycProviderId: kycProviderId ?? null },
    update: { walletAddress, status: 'pending', kycProviderId: kycProviderId ?? null },
  });

  logger.info('[kyc] submitted', { userId, kycProviderId });
  return { userId: record.userId, status: record.status as KycStatus, kycId: record.kycProviderId ?? undefined, submittedAt: record.submittedAt.toISOString() };
}

export async function getKycStatus(userId: string): Promise<KycStatusResult> {
  const record = await (prisma as any).kycRecord.findUnique({ where: { userId } });
  if (!record) return { userId, status: 'pending' };
  return {
    userId: record.userId,
    status: record.status as KycStatus,
    kycId: record.kycProviderId ?? undefined,
    submittedAt: record.submittedAt.toISOString(),
    reviewedAt: record.reviewedAt?.toISOString(),
  };
}

export async function pollAndUpdateStatus(userId: string): Promise<KycStatusResult> {
  const record = await (prisma as any).kycRecord.findUnique({ where: { userId } });
  if (!record || !record.kycProviderId) return getKycStatus(userId);

  const providerUrl = (config as any).kyc?.providerUrl ?? process.env['KYC_PROVIDER_URL'] ?? 'https://sandbox.kyc-provider.example.com';
  const res = await fetch(`${providerUrl}/kyc/${encodeURIComponent(record.kycProviderId)}`);
  if (!res.ok) {
    logger.warn('[kyc] status poll failed', { userId, status: res.status });
    return getKycStatus(userId);
  }

  const body = (await res.json()) as { status?: string };
  const newStatus = (body.status as KycStatus) ?? record.status;

  if (newStatus !== record.status) {
    await emitKycStatusChange(userId, record.status, newStatus);
    await (prisma as any).kycRecord.update({
      where: { userId },
      data: { status: newStatus, reviewedAt: new Date() },
    });
    logger.info('[kyc] status updated', { userId, from: record.status, to: newStatus });
  }

  return getKycStatus(userId);
}

export async function emitKycStatusChange(userId: string, oldStatus: string, newStatus: string): Promise<void> {
  await (prisma as any).kycStatusEvent.create({ data: { userId, oldStatus, newStatus } });
  logger.info('[kyc] status change event emitted', { userId, oldStatus, newStatus });
}

export function verifyKycWebhookSignature(secret: string, rawBody: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}
