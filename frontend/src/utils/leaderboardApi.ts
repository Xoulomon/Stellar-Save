/**
 * leaderboardApi.ts
 * Ranking logic + mock data. Swap fetchLeaderboard() for real contract
 * calls when the on-chain indexer is ready.
 */

import type {
  LeaderboardData,
  LeaderboardGroup,
  LeaderboardMember,
  TimePeriod,
} from '../types/leaderboard';

// ── Ranking algorithms ────────────────────────────────────────────────────────

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
export function scoreMember(m: Omit<LeaderboardMember, 'rank' | 'trend'>): number {
  return (
    m.onTimeRate * 0.5 +
    Math.min(m.streak / 12, 1) * 100 * 0.3 +
    Math.min(m.totalContributed / 10_000, 1) * 100 * 0.2
  );
}

/** Assign ranks and trends after sorting by score descending. */
function assignRanks<T extends object>(
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
      prev === undefined ? 'stable' : curr > prev ? 'up' : curr < prev ? 'down' : 'stable';
    return { ...item, rank: i + 1, trend };
  });
}

// ── Mock data factory ─────────────────────────────────────────────────────────

function mockGroups(period: TimePeriod): LeaderboardGroup[] {
  const base: Omit<LeaderboardGroup, 'rank' | 'trend'>[] = [
    { id: '1',  name: 'Family Savings Circle',   completionRate: 95, totalCycles: 12, completedCycles: 11, memberCount: 8,  totalVolume: 48000, onTimeRate: 97, status: 'active' },
    { id: '3',  name: 'Business Startup Pool',   completionRate: 90, totalCycles: 10, completedCycles: 9,  memberCount: 10, totalVolume: 90000, onTimeRate: 92, status: 'active' },
    { id: '9',  name: 'Healthcare Workers Pool', completionRate: 88, totalCycles: 8,  completedCycles: 7,  memberCount: 7,  totalVolume: 33600, onTimeRate: 94, status: 'active' },
    { id: '5',  name: 'Tech Workers Ajo',        completionRate: 85, totalCycles: 6,  completedCycles: 5,  memberCount: 6,  totalVolume: 27000, onTimeRate: 89, status: 'active' },
    { id: '10', name: 'Women Entrepreneurs Fund',completionRate: 83, totalCycles: 9,  completedCycles: 7,  memberCount: 11, totalVolume: 34650, onTimeRate: 88, status: 'active' },
    { id: '6',  name: 'Diaspora Savings Group',  completionRate: 80, totalCycles: 7,  completedCycles: 5,  memberCount: 15, totalVolume: 21000, onTimeRate: 85, status: 'active' },
    { id: '8',  name: 'Market Traders Circle',   completionRate: 78, totalCycles: 8,  completedCycles: 6,  memberCount: 9,  totalVolume: 28800, onTimeRate: 82, status: 'active' },
    { id: '4',  name: 'Emergency Reserve',       completionRate: 100,totalCycles: 6,  completedCycles: 6,  memberCount: 12, totalVolume: 21600, onTimeRate: 96, status: 'completed' },
    { id: '2',  name: 'Vacation Fund 2026',      completionRate: 60, totalCycles: 5,  completedCycles: 3,  memberCount: 5,  totalVolume: 7500,  onTimeRate: 75, status: 'active' },
    { id: '11', name: 'Retired Teachers Circle', completionRate: 100,totalCycles: 8,  completedCycles: 8,  memberCount: 8,  totalVolume: 12800, onTimeRate: 98, status: 'completed' },
  ];

  // Simulate period variance
  const multiplier = period === 'week' ? 0.15 : period === 'month' ? 0.4 : 1;
  const adjusted = base.map((g) => ({
    ...g,
    totalVolume: Math.round(g.totalVolume * multiplier),
    completedCycles: Math.max(0, Math.round(g.completedCycles * multiplier)),
  }));

  const sorted = [...adjusted].sort((a, b) => scoreGroup(b) - scoreGroup(a));
  return assignRanks(sorted, new Map(), (g) => g.id, scoreGroup).slice(0, 10) as LeaderboardGroup[];
}

function mockMembers(period: TimePeriod): LeaderboardMember[] {
  const base: Omit<LeaderboardMember, 'rank' | 'trend'>[] = [
    { address: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ', name: 'Alice Okonkwo',    totalContributed: 9000,  contributionCount: 36, onTimeRate: 100, streak: 12, groupsParticipated: 3 },
    { address: 'GDEF0987654321FEDCBAZYXWVUTSRQPONMLKJIHGFEDCBA0987654321FED', name: 'Bob Mensah',       totalContributed: 7500,  contributionCount: 30, onTimeRate: 97,  streak: 10, groupsParticipated: 2 },
    { address: 'GXYZ1111222233334444555566667777888899990000AAAABBBBCCCCDDDD', name: 'Carol Adeyemi',    totalContributed: 6000,  contributionCount: 24, onTimeRate: 95,  streak: 8,  groupsParticipated: 2 },
    { address: 'GAAA5555666677778888999900001111222233334444555566667777AAAA', name: 'Dave Nwosu',       totalContributed: 5250,  contributionCount: 21, onTimeRate: 90,  streak: 6,  groupsParticipated: 2 },
    { address: 'GBBB1234ABCD5678EFGH9012IJKL3456MNOP7890QRST1234UVWX5678YZ', name: 'Eve Osei',         totalContributed: 4500,  contributionCount: 18, onTimeRate: 94,  streak: 7,  groupsParticipated: 1 },
    { address: 'GCCC9876ZYXW5432VUTS1098RQPO6543NMLK2109JIHG7654FEDC3210BA', name: 'Frank Asante',     totalContributed: 3600,  contributionCount: 18, onTimeRate: 88,  streak: 5,  groupsParticipated: 2 },
    { address: 'GDDD1111AAAA2222BBBB3333CCCC4444DDDD5555EEEE6666FFFF7777GG', name: 'Grace Boateng',    totalContributed: 3000,  contributionCount: 12, onTimeRate: 92,  streak: 4,  groupsParticipated: 1 },
    { address: 'GEEE8888HHHH9999IIII0000JJJJ1111KKKK2222LLLL3333MMMM4444NN', name: 'Henry Diallo',     totalContributed: 2400,  contributionCount: 12, onTimeRate: 83,  streak: 3,  groupsParticipated: 1 },
    { address: 'GFFF2222OOOO3333PPPP4444QQQQ5555RRRR6666SSSS7777TTTT8888UU', name: 'Irene Kamara',     totalContributed: 1800,  contributionCount: 9,  onTimeRate: 89,  streak: 3,  groupsParticipated: 1 },
    { address: 'GGGG3333VVVV4444WWWW5555XXXX6666YYYY7777ZZZZ8888AAAA9999BB', name: 'James Owusu',      totalContributed: 1500,  contributionCount: 6,  onTimeRate: 100, streak: 6,  groupsParticipated: 1 },
  ];

  const multiplier = period === 'week' ? 0.1 : period === 'month' ? 0.35 : 1;
  const adjusted = base.map((m) => ({
    ...m,
    totalContributed: Math.round(m.totalContributed * multiplier),
    contributionCount: Math.max(1, Math.round(m.contributionCount * multiplier)),
  }));

  const sorted = [...adjusted].sort((a, b) => scoreMember(b) - scoreMember(a));
  return assignRanks(sorted, new Map(), (m) => m.address, scoreMember).slice(0, 10) as LeaderboardMember[];
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchLeaderboard(period: TimePeriod): Promise<LeaderboardData> {
  // TODO: replace with real Soroban/Horizon query
  await new Promise((r) => setTimeout(r, 400));
  return {
    groups: mockGroups(period),
    members: mockMembers(period),
    period,
    generatedAt: new Date(),
  };
}
