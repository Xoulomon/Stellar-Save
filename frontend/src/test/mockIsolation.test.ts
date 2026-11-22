/**
 * mockIsolation.test.ts
 *
 * Verifies that:
 * 1. When VITE_USE_MOCKS=true, fetchGroups returns the mock fixture data.
 * 2. When VITE_USE_MOCKS=false (production), fetchGroups returns an empty
 *    array (no mock data in the response).
 * 3. The leaderboard API behaves the same way under both modes.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

// ── helpers ───────────────────────────────────────────────────────────────────

async function loadGroupApi() {
  vi.resetModules();
  return import('../utils/groupApi');
}

async function loadLeaderboardApi() {
  vi.resetModules();
  return import('../utils/leaderboardApi');
}

// ── groups ────────────────────────────────────────────────────────────────────

describe('groupApi mock gate', () => {
  it('returns mock groups when VITE_USE_MOCKS=true', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    const { fetchGroups } = await loadGroupApi();
    const groups = await fetchGroups();
    expect(groups.length).toBeGreaterThan(0);
    // Spot-check a known fixture name
    expect(groups.some((g) => g.name === 'Family Savings Circle')).toBe(true);
  });

  it('returns empty array when VITE_USE_MOCKS=false', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    const { fetchGroups } = await loadGroupApi();
    const groups = await fetchGroups();
    expect(groups).toEqual([]);
  });

  it('returns null for fetchGroup when VITE_USE_MOCKS=false', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    const { fetchGroup } = await loadGroupApi();
    const group = await fetchGroup('1');
    expect(group).toBeNull();
  });

  it('returns a DetailedGroup for a known id when VITE_USE_MOCKS=true', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    const { fetchGroup } = await loadGroupApi();
    const group = await fetchGroup('1');
    expect(group).not.toBeNull();
    expect(group?.name).toBe('Family Savings Circle');
    expect(Array.isArray(group?.members)).toBe(true);
  });
});

// ── leaderboard ───────────────────────────────────────────────────────────────

describe('leaderboardApi mock gate', () => {
  it('returns mock leaderboard data when VITE_USE_MOCKS=true', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'true');
    const { fetchLeaderboard } = await loadLeaderboardApi();
    const data = await fetchLeaderboard('all');
    expect(data.groups.length).toBeGreaterThan(0);
    expect(data.members.length).toBeGreaterThan(0);
  });

  it('returns empty arrays when VITE_USE_MOCKS=false', async () => {
    vi.stubEnv('VITE_USE_MOCKS', 'false');
    const { fetchLeaderboard } = await loadLeaderboardApi();
    const data = await fetchLeaderboard('all');
    expect(data.groups).toEqual([]);
    expect(data.members).toEqual([]);
  });
});
