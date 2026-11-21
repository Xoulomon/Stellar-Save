/**
 * Ambassador Service
 *
 * Frontend API consumer for ambassador endpoints.
 * All responses follow the standard ApiResponseEnvelope shape: { data, meta, errors }
 */

import { env } from '../lib/env';

const API_BASE_URL = env.VITE_API_URL || 'http://localhost:3000/api/v1';

export enum AmbassadorTier {
  Bronze = 'Bronze',
  Silver = 'Silver',
  Gold = 'Gold',
}

export interface AmbassadorProfile {
  address: string;
  tier: AmbassadorTier;
  reputationScore: number;
  contributionCount: number;
  referrals: number;
  rewardsEarned: number;
  awardedAt: string;
}

export interface EvaluationResult {
  eligible: boolean;
  tier: AmbassadorTier | null;
  profile: AmbassadorProfile | null;
}

export interface RewardResult {
  rewarded: boolean;
  amount: number;
}

/**
 * Generic response envelope type
 */
interface ApiResponseEnvelope<T> {
  data: T | null;
  meta?: Record<string, unknown>;
  errors?: Array<{
    code: string;
    message: string;
    details?: Record<string, unknown>;
  }>;
}

/**
 * Get ambassador leaderboard (public)
 * @returns List of ambassadors ranked by reputation
 */
export async function getLeaderboard(): Promise<AmbassadorProfile[]> {
  const response = await fetch(`${API_BASE_URL}/ambassadors/leaderboard`);

  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<AmbassadorProfile[]>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data || [];
}

/**
 * Get ambassador profile by address (public)
 * @param address - Stellar address
 * @returns Ambassador profile or null if not found
 */
export async function getProfile(address: string): Promise<AmbassadorProfile | null> {
  const response = await fetch(`${API_BASE_URL}/ambassadors/${address}`);

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<AmbassadorProfile>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data;
}

/**
 * Evaluate ambassador status (requires JWT)
 * @param address - Stellar address
 * @param reputationScore - Reputation score (0-1)
 * @param contributions - Number of contributions
 * @param referrals - Number of referrals
 * @returns Evaluation result with tier and profile
 */
export async function evaluateStatus(
  address: string,
  reputationScore: number,
  contributions: number,
  referrals: number
): Promise<EvaluationResult> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/ambassadors/evaluate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      address,
      reputationScore,
      contributions,
      referrals,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to evaluate status: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<EvaluationResult>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data || { eligible: false, tier: null, profile: null };
}

/**
 * Distribute rewards to ambassador (requires admin auth)
 * @param address - Stellar address
 * @param amount - Reward amount
 * @returns Reward result
 */
export async function distributeReward(address: string, amount: number): Promise<RewardResult> {
  const token = localStorage.getItem('auth_token');

  if (!token) {
    throw new Error('Authentication required');
  }

  const response = await fetch(`${API_BASE_URL}/ambassadors/${address}/reward`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }),
  });

  if (!response.ok) {
    throw new Error(`Failed to distribute reward: ${response.statusText}`);
  }

  const envelope = (await response.json()) as ApiResponseEnvelope<RewardResult>;

  if (envelope.errors && envelope.errors.length > 0) {
    throw new Error(envelope.errors[0].message);
  }

  return envelope.data || { rewarded: false, amount: 0 };
}
