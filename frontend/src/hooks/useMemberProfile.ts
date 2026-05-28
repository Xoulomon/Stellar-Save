import { useState, useEffect } from 'react';
import type { UserStats } from './useUserProfile';

export interface MemberProfile {
  address: string;
  displayName: string;
  joinDate: Date;
  stats: UserStats;
  currentStreak: number;
  longestStreak: number;
  /** 0–100 score derived from on-time contributions and group participation */
  reputationScore: number;
}

/**
 * Compute a 0–100 reputation score from member stats and streak.
 * Formula: weighted sum of on-time rate (50%), group participation (30%),
 * and streak bonus (20%).
 */
export function computeReputationScore(
  stats: UserStats,
  currentStreak: number,
): number {
  const onTimeRate =
    stats.completedCycles > 0
      ? Math.min(stats.completedCycles / Math.max(stats.groupsJoined, 1), 1)
      : 0;

  const participationRate = Math.min(stats.activeGroups / 5, 1); // cap at 5 groups

  const streakBonus = Math.min(currentStreak / 50, 1); // cap at 50-cycle streak

  const score = onTimeRate * 50 + participationRate * 30 + streakBonus * 20;
  return Math.round(score);
}

// Mock data keyed by address — replace with Horizon/contract calls
function mockProfileForAddress(address: string): MemberProfile {
  const seed = address.charCodeAt(0) % 10;
  const stats: UserStats = {
    totalContributed: 500 + seed * 150,
    totalReceived: 300 + seed * 100,
    groupsJoined: 2 + (seed % 4),
    activeGroups: 1 + (seed % 3),
    completedCycles: 3 + seed,
    averageContribution: 100 + seed * 25,
  };
  const currentStreak = 5 + seed * 2;
  return {
    address,
    displayName: `Member ${address.slice(0, 6)}`,
    joinDate: new Date(2025, seed % 12, (seed % 28) + 1),
    stats,
    currentStreak,
    longestStreak: currentStreak + seed,
    reputationScore: computeReputationScore(stats, currentStreak),
  };
}

export function useMemberProfile(address: string | undefined) {
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address) {
      setProfile(null);
      return;
    }
    setIsLoading(true);
    setError(null);
    const t = setTimeout(() => {
      try {
        setProfile(mockProfileForAddress(address));
      } catch {
        setError('Failed to load member profile.');
      } finally {
        setIsLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [address]);

  return { profile, isLoading, error };
}
