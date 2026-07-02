import { useState, useEffect } from 'react';

// ── Badge types mirroring the on-chain contract definitions ──────────────────

export type BadgeType =
  | 'founder'
  | 'consistent_contributor'
  | 'payout_received'
  | 'group_completed'
  | 'streak_5'
  | 'streak_10'
  | 'streak_20'
  | 'early_adopter';

export interface MemberBadge {
  /** On-chain badge id (unique per wallet+type) */
  id: string;
  /** Human-readable badge type */
  type: BadgeType;
  /** Display name for this badge */
  name: string;
  /** Short description */
  description: string;
  /** Emoji or image URL for the badge artwork */
  artwork: string;
  /** Unix timestamp when the badge was earned */
  earnedAt: number;
  /** Group ID associated with the badge, if applicable */
  groupId?: string;
}

export interface UseMemberBadgesReturn {
  badges: MemberBadge[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// ── Badge metadata catalogue ─────────────────────────────────────────────────

const BADGE_META: Record<
  BadgeType,
  { name: string; description: string; artwork: string }
> = {
  founder: {
    name: 'Founder',
    description: 'Created one of the first savings groups on Stellar Save.',
    artwork: '🏛️',
  },
  consistent_contributor: {
    name: 'Consistent Contributor',
    description: 'Made on-time contributions for an entire group cycle.',
    artwork: '⭐',
  },
  payout_received: {
    name: 'Payout Received',
    description: 'Received a full ROSCA payout from a completed cycle.',
    artwork: '💸',
  },
  group_completed: {
    name: 'Group Completed',
    description: 'Participated in a group that successfully completed all cycles.',
    artwork: '🏆',
  },
  streak_5: {
    name: '5-Cycle Streak',
    description: 'Contributed on time for 5 consecutive cycles.',
    artwork: '🔥',
  },
  streak_10: {
    name: '10-Cycle Streak',
    description: 'Contributed on time for 10 consecutive cycles.',
    artwork: '💎',
  },
  streak_20: {
    name: '20-Cycle Streak',
    description: 'Contributed on time for 20 consecutive cycles — legendary!',
    artwork: '🌟',
  },
  early_adopter: {
    name: 'Early Adopter',
    description: 'Joined Stellar Save during the founding period.',
    artwork: '🚀',
  },
};

// ── Mock badge data — replace with real get_member_badges contract call ───────

function mockBadgesForAddress(address: string): MemberBadge[] {
  if (!address) return [];

  const seed = address.charCodeAt(0) % 10;

  const allTypes = Object.keys(BADGE_META) as BadgeType[];
  // Deterministically assign some badges based on address seed.
  const earnedTypes = allTypes.filter((_, idx) => (seed + idx) % 3 !== 0);

  return earnedTypes.map((type, idx) => ({
    id: `${address.slice(0, 8)}-${type}`,
    type,
    name: BADGE_META[type].name,
    description: BADGE_META[type].description,
    artwork: BADGE_META[type].artwork,
    earnedAt: Date.now() - (idx + 1) * 7 * 24 * 60 * 60 * 1000, // stagger by weeks
    groupId: idx % 2 === 0 ? `group-${seed + idx}` : undefined,
  }));
}

/**
 * useMemberBadges
 *
 * Fetches the soulbound completion and membership badges for a given wallet
 * address by calling the contract's `get_member_badges` view function.
 *
 * @param address - Stellar wallet address to query badges for
 */
export function useMemberBadges(address: string | undefined): UseMemberBadgesReturn {
  const [badges, setBadges] = useState<MemberBadge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = () => setTick((t) => t + 1);

  useEffect(() => {
    if (!address) {
      setBadges([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    // TODO: Replace with real contract call:
    //   const client = getContractClient();
    //   client.get_member_badges({ member: address })
    //     .then((result) => setBadges(mapContractBadges(result)))
    //     .catch((err) => setError(err.message))
    //     .finally(() => setIsLoading(false));
    const timer = setTimeout(() => {
      try {
        setBadges(mockBadgesForAddress(address));
      } catch (err) {
        setError('Failed to load badges. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [address, tick]);

  return { badges, isLoading, error, refetch };
}
