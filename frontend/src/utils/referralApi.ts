/**
 * Referral reward API helpers.
 *
 * Referral rewards accrue on-chain when a referred member completes their
 * first contribution cycle. The balance is claimable at any time via the
 * contract. This module wraps those endpoints.
 */

const API_BASE = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? '/api/v1';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReferralReward {
  referrerAddress: string;
  /** Accrued but unclaimed balance in stroops (1 XLM = 10_000_000 stroops). */
  pendingBalance: bigint;
  /** Total claimed to date in stroops. */
  totalClaimed: bigint;
  referralCount: number;
  lastUpdated: number;
}

export interface ClaimResult {
  txHash: string;
  amountClaimed: bigint;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchReferralRewards(address: string): Promise<ReferralReward> {
  const res = await fetch(
    `${API_BASE}/referrals/${encodeURIComponent(address)}/rewards`,
  );
  if (!res.ok) throw new Error('Failed to fetch referral rewards');
  const data = await res.json() as {
    referrerAddress: string;
    pendingBalance: string;
    totalClaimed: string;
    referralCount: number;
    lastUpdated: number;
  };
  return {
    ...data,
    pendingBalance: BigInt(data.pendingBalance),
    totalClaimed: BigInt(data.totalClaimed),
  };
}

export async function claimReferralRewards(address: string): Promise<ClaimResult> {
  const res = await fetch(
    `${API_BASE}/referrals/${encodeURIComponent(address)}/claim`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' } },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Claim failed' })) as { error: string };
    throw new Error(err.error ?? 'Claim failed');
  }
  const data = await res.json() as { txHash: string; amountClaimed: string };
  return { txHash: data.txHash, amountClaimed: BigInt(data.amountClaimed) };
}

// ── Formatting helpers ────────────────────────────────────────────────────────

const STROOPS_PER_XLM = 10_000_000n;

export function stroopsToXlm(stroops: bigint): string {
  const whole = stroops / STROOPS_PER_XLM;
  const frac = stroops % STROOPS_PER_XLM;
  const fracStr = frac.toString().padStart(7, '0').replace(/0+$/, '') || '0';
  return `${whole}.${fracStr}`;
}
