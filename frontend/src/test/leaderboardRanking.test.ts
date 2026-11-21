import { describe, it, expect } from 'vitest';

import {
  assignRanks,
  periodMultiplier,
  rankGroups,
  rankMembers,
  scoreGroup,
  scoreMember,
} from '../utils/leaderboardRanking';

import type { LeaderboardGroup, LeaderboardMember } from '../types/leaderboard';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const GROUP_A: Omit<LeaderboardGroup, 'rank' | 'trend'> = {
  id: 'a',
  name: 'Group A',
  completionRate: 100,
  totalCycles: 10,
  completedCycles: 10,
  memberCount: 5,
  totalVolume: 50000,
  onTimeRate: 100,
  status: 'active',
};

const GROUP_B: Omit<LeaderboardGroup, 'rank' | 'trend'> = {
  id: 'b',
  name: 'Group B',
  completionRate: 50,
  totalCycles: 10,
  completedCycles: 5,
  memberCount: 5,
  totalVolume: 10000,
  onTimeRate: 60,
  status: 'active',
};

const MEMBER_A: Omit<LeaderboardMember, 'rank' | 'trend'> = {
  address: 'GAAA',
  name: 'Alice',
  totalContributed: 10000,
  contributionCount: 36,
  onTimeRate: 100,
  streak: 12,
  groupsParticipated: 3,
};

const MEMBER_B: Omit<LeaderboardMember, 'rank' | 'trend'> = {
  address: 'GBBB',
  name: 'Bob',
  totalContributed: 1000,
  contributionCount: 4,
  onTimeRate: 50,
  streak: 0,
  groupsParticipated: 1,
};

// ── scoreGroup ────────────────────────────────────────────────────────────────

describe('scoreGroup', () => {
  it('returns a number between 0 and 100', () => {
    const s = scoreGroup(GROUP_A);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('higher completion/on-time/volume gives a higher score', () => {
    expect(scoreGroup(GROUP_A)).toBeGreaterThan(scoreGroup(GROUP_B));
  });

  it('max possible score approaches 100', () => {
    const perfect: Omit<LeaderboardGroup, 'rank' | 'trend'> = {
      ...GROUP_A,
      completionRate: 100,
      onTimeRate: 100,
      totalVolume: 100_000,
    };
    expect(scoreGroup(perfect)).toBe(100);
  });

  it('zero values yield zero score', () => {
    const zero: Omit<LeaderboardGroup, 'rank' | 'trend'> = {
      ...GROUP_A,
      completionRate: 0,
      onTimeRate: 0,
      totalVolume: 0,
    };
    expect(scoreGroup(zero)).toBe(0);
  });
});

// ── scoreMember ───────────────────────────────────────────────────────────────

describe('scoreMember', () => {
  it('returns a number between 0 and 100', () => {
    const s = scoreMember(MEMBER_A);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(100);
  });

  it('higher on-time / streak / contribution gives higher score', () => {
    expect(scoreMember(MEMBER_A)).toBeGreaterThan(scoreMember(MEMBER_B));
  });
});

// ── assignRanks ───────────────────────────────────────────────────────────────

describe('assignRanks', () => {
  it('assigns rank starting at 1', () => {
    const items = [GROUP_A, GROUP_B];
    const ranked = assignRanks(items, new Map(), (g) => g.id, scoreGroup);
    expect(ranked[0].rank).toBe(1);
    expect(ranked[1].rank).toBe(2);
  });

  it('marks trend as stable when no previous scores', () => {
    const [r] = assignRanks([GROUP_A], new Map(), (g) => g.id, scoreGroup);
    expect(r.trend).toBe('stable');
  });

  it('marks trend as up when score increased', () => {
    const prev = new Map([['a', 0]]);
    const [r] = assignRanks([GROUP_A], prev, (g) => g.id, scoreGroup);
    expect(r.trend).toBe('up');
  });

  it('marks trend as down when score decreased', () => {
    const prev = new Map([['a', 999]]);
    const [r] = assignRanks([GROUP_A], prev, (g) => g.id, scoreGroup);
    expect(r.trend).toBe('down');
  });
});

// ── rankGroups ────────────────────────────────────────────────────────────────

describe('rankGroups', () => {
  it('returns groups sorted by score descending', () => {
    const ranked = rankGroups([GROUP_B, GROUP_A]);
    expect(ranked[0].id).toBe('a'); // GROUP_A has a higher score
  });

  it('respects limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ...GROUP_A, id: String(i) }));
    expect(rankGroups(many, new Map(), 5)).toHaveLength(5);
  });

  it('defaults to top 10', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...GROUP_A, id: String(i) }));
    expect(rankGroups(many)).toHaveLength(10);
  });
});

// ── rankMembers ───────────────────────────────────────────────────────────────

describe('rankMembers', () => {
  it('returns members sorted by score descending', () => {
    const ranked = rankMembers([MEMBER_B, MEMBER_A]);
    expect(ranked[0].address).toBe('GAAA');
  });

  it('respects limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...MEMBER_A,
      address: `GADDR${i}`,
    }));
    expect(rankMembers(many, new Map(), 3)).toHaveLength(3);
  });
});

// ── periodMultiplier ──────────────────────────────────────────────────────────

describe('periodMultiplier', () => {
  it('returns 1 for all-time', () => {
    expect(periodMultiplier('all-time')).toBe(1);
  });

  it('returns < 1 for week and month', () => {
    expect(periodMultiplier('week')).toBeLessThan(1);
    expect(periodMultiplier('month')).toBeLessThan(1);
  });

  it('week < month < all-time', () => {
    expect(periodMultiplier('week')).toBeLessThan(periodMultiplier('month'));
    expect(periodMultiplier('month')).toBeLessThan(periodMultiplier('all-time'));
  });
});
