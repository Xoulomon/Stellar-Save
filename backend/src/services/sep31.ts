/**
 * SEP-31 cross-border payment support (Issue #1025).
 *
 * Implements the sending-anchor flow: quote → validate compliance → send → reconcile.
 */

import { logger } from '../logger';
import { prisma } from '../prisma_client';

export interface Sep31QuoteOpts {
  anchorDomain: string;
  sendAsset: string;
  receiveAsset: string;
  amount: string;
}

export interface Sep31Quote {
  rate: string;
  fee: string;
  expiresAt: string;
}

export interface Sep31SendOpts {
  anchorDomain: string;
  sendAssetCode: string;
  receiveAssetCode: string;
  amount: string;
  senderId: string;
  receiverId: string;
  fields: Record<string, string>;
  groupId?: string;
}

export interface Sep31SendResult {
  id: string;
  anchorTxId: string;
  stellarAccountId: string;
  stellarMemo: string;
  stellarMemoType: string;
}

export interface Sep31StatusResult {
  id: string;
  status: string;
  completedAt?: string;
}

async function fetchToml(anchorDomain: string): Promise<Record<string, string>> {
  const url = `https://${anchorDomain}/.well-known/stellar.toml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch TOML from ${url}: ${res.status}`);
  const text = await res.text();
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

async function getDirectPaymentServer(anchorDomain: string): Promise<string> {
  const toml = await fetchToml(anchorDomain);
  return toml['DIRECT_PAYMENT_SERVER'] ?? `https://${anchorDomain}/sep31`;
}

/**
 * Fetch anchor's /info to get required compliance fields, then validate provided fields.
 * Throws an error listing any missing required fields.
 */
export async function validateComplianceFields(anchorDomain: string, fields: Record<string, string>): Promise<void> {
  const server = await getDirectPaymentServer(anchorDomain);
  const res = await fetch(`${server}/info`);
  if (!res.ok) throw new Error(`SEP-31 /info failed: ${res.status}`);

  const body = (await res.json()) as { receive?: Record<string, { fields?: Record<string, { optional?: boolean }> }> };
  const receiveAssets = body.receive ?? {};

  const missing: string[] = [];
  for (const assetInfo of Object.values(receiveAssets)) {
    for (const [fieldName, fieldMeta] of Object.entries(assetInfo.fields ?? {})) {
      if (!fieldMeta.optional && !fields[fieldName]) {
        missing.push(fieldName);
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required compliance fields: ${missing.join(', ')}`);
  }
}

/**
 * Get a rate quote for a cross-border payment.
 */
export async function getQuote(opts: Sep31QuoteOpts): Promise<Sep31Quote> {
  const { anchorDomain, sendAsset, receiveAsset, amount } = opts;
  const server = await getDirectPaymentServer(anchorDomain);
  const url = `${server}/rate?send_asset=${encodeURIComponent(sendAsset)}&receive_asset=${encodeURIComponent(receiveAsset)}&amount=${encodeURIComponent(amount)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`SEP-31 rate quote failed: ${res.status}`);
  const body = (await res.json()) as { rate?: string; fee?: string; expires_at?: string };
  return {
    rate: body.rate ?? '1',
    fee: body.fee ?? '0',
    expiresAt: body.expires_at ?? new Date(Date.now() + 3600_000).toISOString(),
  };
}

/**
 * Initiate a SEP-31 cross-border payment.
 */
export async function sendPayment(opts: Sep31SendOpts): Promise<Sep31SendResult> {
  const { anchorDomain, sendAssetCode, receiveAssetCode, amount, senderId, receiverId, fields, groupId } = opts;

  await validateComplianceFields(anchorDomain, fields);

  const server = await getDirectPaymentServer(anchorDomain);
  const res = await fetch(`${server}/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount,
      asset_code: sendAssetCode,
      destination_asset: receiveAssetCode,
      sender_id: senderId,
      receiver_id: receiverId,
      fields: { transaction: fields },
    }),
  });
  if (!res.ok) throw new Error(`SEP-31 transaction initiation failed: ${res.status}`);

  const body = (await res.json()) as {
    id: string;
    stellar_account_id: string;
    stellar_memo: string;
    stellar_memo_type: string;
  };

  const record = await (prisma as any).crossBorderPayment.create({
    data: {
      anchorDomain,
      sendAssetCode,
      receiveAssetCode,
      amount,
      senderId,
      receiverId,
      anchorTxId: body.id,
      status: 'pending',
      stellarAccount: body.stellar_account_id,
      stellarMemo: body.stellar_memo ?? null,
      groupId: groupId ?? null,
    },
  });

  logger.info('[sep31] payment initiated', { anchorTxId: body.id, groupId });
  return { id: record.id, anchorTxId: body.id, stellarAccountId: body.stellar_account_id, stellarMemo: body.stellar_memo, stellarMemoType: body.stellar_memo_type };
}

/**
 * Fetch latest status from anchor and reconcile local record.
 */
export async function getPaymentStatus(anchorDomain: string, id: string): Promise<Sep31StatusResult> {
  const record = await (prisma as any).crossBorderPayment.findUnique({ where: { id } });
  if (!record) throw new Error(`CrossBorderPayment ${id} not found`);

  if (!record.anchorTxId) return { id, status: record.status };

  const server = await getDirectPaymentServer(anchorDomain);
  const res = await fetch(`${server}/transaction/${encodeURIComponent(record.anchorTxId)}`);
  if (!res.ok) {
    logger.warn('[sep31] status poll failed', { id, status: res.status });
    return { id, status: record.status };
  }

  const body = (await res.json()) as { transaction?: { status?: string; completed_at?: string } };
  const anchorStatus = body.transaction?.status ?? record.status;
  const completedAt = body.transaction?.completed_at;

  if (anchorStatus !== record.status) {
    await (prisma as any).crossBorderPayment.update({ where: { id }, data: { status: anchorStatus } });
    logger.info('[sep31] status reconciled', { id, from: record.status, to: anchorStatus });
  }

  return { id, status: anchorStatus, completedAt };
}
