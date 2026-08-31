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
  awardedAt: Date;
}

const store = new Map<string, AmbassadorProfile>();

export function evaluateAmbassadorStatus(
  address: string,
  reputationScore: number,
  contributions: number,
  referrals: number,
): AmbassadorTier | null {
  if (reputationScore >= 0.95 && contributions >= 30 && referrals >= 10) return AmbassadorTier.Gold;
  if (reputationScore >= 0.85 && contributions >= 15 && referrals >= 3) return AmbassadorTier.Silver;
  if (reputationScore >= 0.7 && contributions >= 5) return AmbassadorTier.Bronze;
  return null;
}

export function getAmbassadorProfile(address: string): AmbassadorProfile | null {
  return store.get(address) ?? null;
}

export function getAmbassadorLeaderboard(): AmbassadorProfile[] {
  return [...store.values()].sort((a, b) => b.reputationScore - a.reputationScore);
}

export function distributeRewards(address: string, amount: number): void {
  const profile = store.get(address);
  if (!profile) throw new Error(`No ambassador profile found for ${address}`);
  profile.rewardsEarned += amount;
}

export function saveAmbassadorProfile(
  address: string,
  tier: AmbassadorTier,
  reputationScore: number,
  contributionCount: number,
  referrals: number,
): AmbassadorProfile {
  const existing = store.get(address);
  const profile: AmbassadorProfile = {
    address,
    tier,
    reputationScore,
    contributionCount,
    referrals,
    rewardsEarned: existing?.rewardsEarned ?? 0,
    awardedAt: existing?.awardedAt ?? new Date(),
  };
  store.set(address, profile);
  return profile;
}
