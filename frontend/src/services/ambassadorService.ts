/**
 * Ambassador Service
 *
 * Frontend API consumer for ambassador endpoints.
 * All responses follow the standard ApiResponseEnvelope shape: { data, meta, errors }
 */

import { apiRequest } from './apiClient';

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
/**
 * Get ambassador leaderboard (public)
 * @returns List of ambassadors ranked by reputation
 */
export async function getLeaderboard(): Promise<AmbassadorProfile[]> {
  return (
    (await apiRequest<AmbassadorProfile[]>('/ambassadors/leaderboard', {
      errorLabel: 'fetch leaderboard',
    })) || []
  );
}

/**
 * Get ambassador profile by address (public)
 * @param address - Stellar address
 * @returns Ambassador profile or null if not found
 */
export async function getProfile(address: string): Promise<AmbassadorProfile | null> {
  const profile = await apiRequest<AmbassadorProfile>(
    `/ambassadors/${encodeURIComponent(address)}`,
    {
      acceptedStatuses: [404],
      errorLabel: 'fetch profile',
    }
  );
  return profile;
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
  return (
    (await apiRequest<EvaluationResult>('/ambassadors/evaluate', {
      method: 'POST',
      authenticated: true,
      errorLabel: 'evaluate status',
      body: {
        address,
        reputationScore,
        contributions,
        referrals,
      },
    })) || { eligible: false, tier: null, profile: null }
  );
}

/**
 * Distribute rewards to ambassador (requires admin auth)
 * @param address - Stellar address
 * @param amount - Reward amount
 * @returns Reward result
 */
export async function distributeReward(address: string, amount: number): Promise<RewardResult> {
  return (
    (await apiRequest<RewardResult>(`/ambassadors/${encodeURIComponent(address)}/reward`, {
      method: 'POST',
      authenticated: true,
      errorLabel: 'distribute reward',
      body: { amount },
    })) || { rewarded: false, amount: 0 }
  );
}
