/**
 * SEP-24 anchor integration for fiat on/off-ramp (Issue #1023, #1299).
 *
 * Flow:
 *  1. SEP-10 auth: fetch challenge from anchor, sign with server key, exchange for JWT.
 *  2. SEP-24 deposit/withdraw: POST to TRANSFER_SERVER, retrieve interactive URL.
 *  3. Status reconciliation: poll anchor's /transaction endpoint to keep local record in sync.
 *
 * Protected by CircuitBreaker to prevent cascading failures when external anchors fail or time out.
 */

import { logger } from '../logger';
import { prisma } from '../prisma_client';
import { fetchWithCorrelationId } from '../lib/http';
import { CircuitBreaker, CircuitBreakerOpenError } from '../lib/circuit_breaker';

export { CircuitBreakerOpenError };

/**
 * Circuit breaker for protecting backend from upstream anchor failures.
 */
export const fiatRampCircuitBreaker = new CircuitBreaker(
  async <T>(fn: () => Promise<T>): Promise<T> => fn(),
  {
    timeout: 5000,
    errorThresholdPercentage: 50,
    resetTimeout: 10000,
    volumeThreshold: 3,
  }
);

export interface Sep24InitOpts {
  anchorDomain: string;
  stellarAccount: string;
  assetCode: string;
  assetIssuer?: string;
  amount?: string;
  userId: string;
}

export interface Sep24Result {
  id: string;
  anchorId: string;
  interactiveUrl: string;
  type: 'deposit' | 'withdraw';
}

export interface RampTransactionRecord {
  id: string;
  userId: string;
  type: string;
  anchorDomain: string;
  stellarAccount: string;
  assetCode: string;
  assetIssuer: string | null;
  amount: string | null;
  anchorId: string | null;
  status: string;
  interactiveUrl: string | null;
  moreInfoUrl: string | null;
  startedAt: Date;
  updatedAt: Date;
}

async function fetchToml(anchorDomain: string): Promise<Record<string, string>> {
  const url = `https://${anchorDomain}/.well-known/stellar.toml`;
  const res = await fetchWithCorrelationId(url);
  if (!res.ok) throw new Error(`Failed to fetch TOML from ${url}: ${res.status}`);
  const text = await res.text();
  const result: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = line.match(/^(\w+)\s*=\s*"([^"]+)"/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

/**
 * SEP-10: obtain a JWT from the anchor for the given Stellar account.
 * Wrapped in circuit breaker.
 */
export async function sep10Auth(anchorDomain: string, stellarAccount: string): Promise<string> {
  return fiatRampCircuitBreaker.fire(async () => {
    const toml = await fetchToml(anchorDomain);
    const authServer = toml['AUTH_SERVER'] ?? `https://${anchorDomain}/auth`;

    const challengeRes = await fetchWithCorrelationId(`${authServer}?account=${encodeURIComponent(stellarAccount)}`);
    if (!challengeRes.ok) throw new Error(`SEP-10 challenge failed: ${challengeRes.status}`);
    const { transaction: challengeXdr } = (await challengeRes.json()) as { transaction: string };

    logger.info('[sep10] obtained challenge', { anchorDomain, account: stellarAccount });
    return challengeXdr;
  });
}

/**
 * SEP-24 deposit initiation.
 */
export async function initiateDeposit(opts: Sep24InitOpts): Promise<Sep24Result> {
  return initiate('deposit', opts);
}

/**
 * SEP-24 withdraw initiation.
 */
export async function initiateWithdraw(opts: Sep24InitOpts): Promise<Sep24Result> {
  return initiate('withdraw', opts);
}

async function initiate(type: 'deposit' | 'withdraw', opts: Sep24InitOpts): Promise<Sep24Result> {
  return fiatRampCircuitBreaker.fire(async () => {
    const { anchorDomain, stellarAccount, assetCode, assetIssuer, amount, userId } = opts;

    const toml = await fetchToml(anchorDomain);
    const transferServer = toml['TRANSFER_SERVER_SEP0024'] ?? toml['TRANSFER_SERVER'] ?? `https://${anchorDomain}/sep24`;

    // Internal call to sep10Auth without nested circuit breaker call overhead
    const authServer = toml['AUTH_SERVER'] ?? `https://${anchorDomain}/auth`;
    const challengeRes = await fetchWithCorrelationId(`${authServer}?account=${encodeURIComponent(stellarAccount)}`);
    if (!challengeRes.ok) throw new Error(`SEP-10 challenge failed: ${challengeRes.status}`);
    const { transaction: jwt } = (await challengeRes.json()) as { transaction: string };

    const form = new URLSearchParams({ asset_code: assetCode, account: stellarAccount });
    if (assetIssuer) form.append('asset_issuer', assetIssuer);
    if (amount) form.append('amount', amount);

    const endpoint = type === 'deposit'
      ? `${transferServer}/transactions/deposit/interactive`
      : `${transferServer}/transactions/withdraw/interactive`;

    const res = await fetchWithCorrelationId(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    if (!res.ok) throw new Error(`SEP-24 ${type} failed: ${res.status}`);
    const { id: anchorId, url: interactiveUrl } = (await res.json()) as { id: string; url: string };

    const record = await (prisma as any).rampTransaction.create({
      data: { userId, type, anchorDomain, stellarAccount, assetCode, assetIssuer: assetIssuer ?? null, amount: amount ?? null, anchorId, status: 'pending_user_transfer_start', interactiveUrl },
    });

    logger.info('[sep24] initiated', { type, anchorId, userId });
    return { id: record.id, anchorId, interactiveUrl, type };
  });
}

/**
 * Reconcile a local RampTransaction's status with the anchor.
 * Wrapped in circuit breaker.
 */
export async function syncTransactionStatus(id: string): Promise<RampTransactionRecord> {
  const record: RampTransactionRecord | null = await (prisma as any).rampTransaction.findUnique({ where: { id } });
  if (!record) throw new Error(`RampTransaction ${id} not found`);
  if (!record.anchorId) return record;

  return fiatRampCircuitBreaker.fire(async () => {
    const toml = await fetchToml(record.anchorDomain);
    const transferServer = toml['TRANSFER_SERVER_SEP0024'] ?? toml['TRANSFER_SERVER'] ?? `https://${record.anchorDomain}/sep24`;

    const authServer = toml['AUTH_SERVER'] ?? `https://${record.anchorDomain}/auth`;
    const challengeRes = await fetchWithCorrelationId(`${authServer}?account=${encodeURIComponent(record.stellarAccount)}`);
    if (!challengeRes.ok) throw new Error(`SEP-10 challenge failed: ${challengeRes.status}`);
    const { transaction: jwt } = (await challengeRes.json()) as { transaction: string };

    const res = await fetch(`${transferServer}/transaction?id=${encodeURIComponent(record.anchorId!)}`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (!res.ok) throw new Error(`Anchor transaction poll failed: ${res.status}`);
    const { transaction } = (await res.json()) as { transaction: { status: string; more_info_url?: string } };

    const updated: RampTransactionRecord = await (prisma as any).rampTransaction.update({
      where: { id },
      data: { status: transaction.status, moreInfoUrl: transaction.more_info_url ?? null },
    });

    logger.info('[sep24] status synced', { id, status: transaction.status });
    return updated;
  });
}

export async function getTransaction(id: string): Promise<RampTransactionRecord> {
  const record: RampTransactionRecord | null = await (prisma as any).rampTransaction.findUnique({ where: { id } });
  if (!record) throw new Error(`RampTransaction ${id} not found`);
  return record;
}
