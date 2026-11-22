/**
 * leaderboardRanking.ts
 *
 * Pure ranking and filtering functions for the leaderboard.
 * These functions have no side-effects and no external dependencies —
 * they can be tested in isolation without any React or network context.
 */

import type {
  LeaderboardGroup,
  LeaderboardMember,
  TimePeriod,
} from '../types/leaderboard';

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Score a group: weighted combination of completion rate, on-time rate,
 * and normalised volume. Returns 0–100.
 */
export function scoreGroup(g: Omit<LeaderboardGroup, 'rank' | 'trend'>): number {
  return (
    g.completionRate * 0.5 +
    g.onTimeRate * 0.3 +
    Math.min(g.totalVolume / 100_000, 1) * 100 * 0.2
  );
}

/**
 * Score a member: weighted combination of on-time rate, streak, and
 * normalised total contributed. Returns 0–100.
 */
export function scoreMember(
  m: Omit<LeaderboardMember, 'rank' | 'trend'>,
): number {
  return (
    m.onTimeRate * 0.5 +
    Math.min(m.streak / 12, 1) * 100 * 0.3 +
    Math.min(m.totalContributed / 10_000, 1) * 100 * 0.2
  );
}

// ── Rank assignment ───────────────────────────────────────────────────────────

/**
 * Assign ranks and trends to a pre-sorted list (highest score first).
 *
 * @param items     Array of items already sorted by score descending.
 * @param prevScores Map of key → previous score for trend calculation.
 * @param keyFn     Extracts a stable identity key from an item.
 * @param scoreFn   Computes the current score for an item.
 */
export function assignRanks<T extends object>(
  items: T[],
  prevScores: Map<string, number>,
  keyFn: (item: T) => string,
  scoreFn: (item: T) => number,
): (T & { rank: number; trend: 'up' | 'down' | 'stable' })[] {
  return items.map((item, i) => {
    const key = keyFn(item);
    const prev = prevScores.get(key);
    const curr = scoreFn(item);
    const trend: 'up' | 'down' | 'stable' =
      prev === undefined
        ? 'stable'
        : curr > prev
          ? 'up'
          : curr < prev
            ? 'down'
            : 'stable';
    return { ...item, rank: i + 1, trend };
  });
}

// ── Period multiplier ─────────────────────────────────────────────────────────

/**
 * Returns a volume/contribution multiplier for a given time period.
 * Used to simulate realistic period-relative data from totals.
 */
export function periodMultiplier(period: TimePeriod): number {
  switch (period) {
    case 'week':
      return 0.15;
    case 'month':
      return 0.4;
    case 'all-time':
      return 1;
  }
}

// ── Ranking helpers ───────────────────────────────────────────────────────────

/**
 * Sort and rank a list of groups by score, optionally against previous scores
 * for trend calculation. Returns at most `limit` items.
 */
export function rankGroups(
  groups: Omit<LeaderboardGroup, 'rank' | 'trend'>[],
  prevScores: Map<string, number> = new Map(),
  limit = 10,
): LeaderboardGroup[] {
  const sorted = [...groups].sort((a, b) => scoreGroup(b) - scoreGroup(a));
  return assignRanks(
    sorted,
    prevScores,
    (g) => g.id,
    scoreGroup,
  ).slice(0, limit) as LeaderboardGroup[];
}

/**
 * Sort and rank a list of members by score, optionally against previous scores
 * for trend calculation. Returns at most `limit` items.
 */
export function rankMembers(
  members: Omit<LeaderboardMember, 'rank' | 'trend'>[],
  prevScores: Map<string, number> = new Map(),
  limit = 10,
): LeaderboardMember[] {
  const sorted = [...members].sort((a, b) => scoreMember(b) - scoreMember(a));
  return assignRanks(
    sorted,
    prevScores,
    (m) => m.address,
    scoreMember,
  ).slice(0, limit) as LeaderboardMember[];
}
