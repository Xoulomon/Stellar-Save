/**
 * Integration tests for /api/groups and /api/groups/:id.
 *
 * Each describe block builds its own Express app seeded from GroupFixtureFactory
 * via a local `buildGroupApp` helper. The helper mirrors the same wiring used in
 * test/helpers/app.ts but scoped to just the groups router so there are no
 * external service dependencies (no Prisma, no S3, no Redis).
 *
 * Related: issue #83
 */

import request from 'supertest';
import { buildGroupApp } from '../helpers/groupApp';
import { GroupFixtureFactory } from '../fixtures/groups';
import { Group } from '../../src/models';

// ── Shared default app ────────────────────────────────────────────────────────
// Mirrors the original seed so existing assertions are unchanged.

const defaultGroups = GroupFixtureFactory.buildGroupList(3);
// Give the first group a well-known id and name to keep the original tests.
defaultGroups[0] = { ...defaultGroups[0], id: '1', name: 'Weekly Savers' };

const defaultApp = buildGroupApp(defaultGroups);

describe('GET /api/groups — default seed', () => {
  it('returns 200 with an array of groups', async () => {
    const res = await request(defaultApp).get('/api/groups');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('each group has required fields', async () => {
    const res = await request(defaultApp).get('/api/groups');
    for (const group of res.body) {
      expect(group).toHaveProperty('id');
      expect(group).toHaveProperty('name');
      expect(group).toHaveProperty('contributionAmount');
      expect(group).toHaveProperty('maxMembers');
      expect(group).toHaveProperty('status');
    }
  });
});

describe('GET /api/groups/:id — default seed', () => {
  it('returns 200 with the matching group', async () => {
    const res = await request(defaultApp).get('/api/groups/1');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('1');
    expect(res.body.name).toBe('Weekly Savers');
  });

  it('returns 404 for an unknown group id', async () => {
    const res = await request(defaultApp).get('/api/groups/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ── Fully-contributed group ───────────────────────────────────────────────────

describe('GET /api/groups — fully-contributed group (all N members have paid)', () => {
  const MEMBER_COUNT = 6;
  const { group, contributionStates } = GroupFixtureFactory.buildGroupWithMembers(
    MEMBER_COUNT,
    { id: 'full-grp', name: 'Full Contributors', contributionAmount: 250 }
  );
  const app = buildGroupApp([group]);

  it('returns the group with currentMembers equal to maxMembers', async () => {
    const res = await request(app).get('/api/groups/full-grp');
    expect(res.status).toBe(200);
    expect(res.body.currentMembers).toBe(MEMBER_COUNT);
    expect(res.body.maxMembers).toBe(MEMBER_COUNT);
  });

  it('reports the correct contribution amount', async () => {
    const res = await request(app).get('/api/groups/full-grp');
    expect(res.body.contributionAmount).toBe(250);
  });

  it('the group is still active (payout not yet executed via API)', async () => {
    const res = await request(app).get('/api/groups/full-grp');
    expect(res.body.status).toBe('Active');
  });

  it('fixture: all members are marked as contributed', () => {
    expect(contributionStates.every((s) => s.hasContributed)).toBe(true);
  });

  it('fixture: every contributing member has a linked transaction', () => {
    for (const state of contributionStates) {
      expect(state.transaction).toBeDefined();
      expect(state.transaction!.memberAddress).toBe(state.member.address);
      expect(state.transaction!.type).toBe('contribution');
    }
  });
});

// ── Mixed contribution state ──────────────────────────────────────────────────

describe('GET /api/groups — mixed contribution state (partial cycle)', () => {
  const TOTAL = 8;
  const PAID = 5;
  const { group, contributionStates } = GroupFixtureFactory.buildMixedContributionGroup(
    TOTAL,
    PAID,
    { id: 'mixed-grp', name: 'Mid-Cycle Group' }
  );
  const app = buildGroupApp([group]);

  it('returns 200 for the group', async () => {
    const res = await request(app).get('/api/groups/mixed-grp');
    expect(res.status).toBe(200);
  });

  it('maxMembers equals the total member count', async () => {
    const res = await request(app).get('/api/groups/mixed-grp');
    expect(res.body.maxMembers).toBe(TOTAL);
  });

  it('fixture: paid/unpaid split matches expectation', () => {
    const paid = contributionStates.filter((s) => s.hasContributed);
    const pending = contributionStates.filter((s) => !s.hasContributed);
    expect(paid).toHaveLength(PAID);
    expect(pending).toHaveLength(TOTAL - PAID);
  });

  it('fixture: each contributing member has a linked transaction', () => {
    const paidStates = contributionStates.filter((s) => s.hasContributed);
    for (const state of paidStates) {
      expect(state.transaction).toBeDefined();
      expect(state.transaction!.memberAddress).toBe(state.member.address);
      expect(state.transaction!.type).toBe('contribution');
    }
  });

  it('fixture: non-contributing members have no transaction', () => {
    const pendingStates = contributionStates.filter((s) => !s.hasContributed);
    for (const state of pendingStates) {
      expect(state.transaction).toBeUndefined();
    }
  });
});

// ── Near-payout state ─────────────────────────────────────────────────────────

describe('GET /api/groups — near-payout state (all but one member has paid)', () => {
  const MEMBER_COUNT = 5;
  const { group, contributionStates } = GroupFixtureFactory.buildNearPayoutGroup(
    MEMBER_COUNT,
    { id: 'near-payout-grp', name: 'Almost Ready' }
  );
  const app = buildGroupApp([group]);

  it('returns the group with Active status', async () => {
    const res = await request(app).get('/api/groups/near-payout-grp');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Active');
  });

  it('fixture: exactly one member has not yet contributed', () => {
    const pending = contributionStates.filter((s) => !s.hasContributed);
    expect(pending).toHaveLength(1);
  });

  it('fixture: all other members have contribution transactions', () => {
    const paid = contributionStates.filter((s) => s.hasContributed);
    expect(paid).toHaveLength(MEMBER_COUNT - 1);
    for (const state of paid) {
      expect(state.transaction).toBeDefined();
    }
  });
});

// ── Completed group ───────────────────────────────────────────────────────────

describe('GET /api/groups — completed group', () => {
  const MEMBER_COUNT = 4;
  const { group, transactions } = GroupFixtureFactory.buildCompletedGroup(MEMBER_COUNT, {
    id: 'done-grp',
    name: 'Finished Circle',
    contributionAmount: 500,
  });
  const app = buildGroupApp([group]);

  it('returns the group with Completed status', async () => {
    const res = await request(app).get('/api/groups/done-grp');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Completed');
  });

  it('fixture: one payout transaction per member', () => {
    const payouts = transactions.filter((t) => t.type === 'payout');
    expect(payouts).toHaveLength(MEMBER_COUNT);
  });

  it('fixture: each payout equals contributionAmount × memberCount', () => {
    const expectedPayout = 500 * MEMBER_COUNT;
    for (const tx of transactions) {
      expect(tx.amount).toBe(expectedPayout);
    }
  });
});

// ── Paused group ──────────────────────────────────────────────────────────────

describe('GET /api/groups — paused group', () => {
  const MEMBER_COUNT = 6;
  const CONTRIBUTED_BEFORE_PAUSE = 3;
  const { group, contributionStates } = GroupFixtureFactory.buildPausedGroup(
    MEMBER_COUNT,
    CONTRIBUTED_BEFORE_PAUSE,
    { id: 'paused-grp', name: 'On Hold' }
  );
  const app = buildGroupApp([group]);

  it('returns the group with Paused status', async () => {
    const res = await request(app).get('/api/groups/paused-grp');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Paused');
  });

  it('fixture: contribution state prior to pause is preserved', () => {
    const paid = contributionStates.filter((s) => s.hasContributed);
    expect(paid).toHaveLength(CONTRIBUTED_BEFORE_PAUSE);
  });
});

// ── Large group boundary ──────────────────────────────────────────────────────

describe('GET /api/groups — large group (20 members, all contributed)', () => {
  const MEMBER_COUNT = 20;
  const { group, contributionStates } = GroupFixtureFactory.buildGroupWithMembers(
    MEMBER_COUNT,
    { id: 'large-grp', name: 'Large Savers', contributionAmount: 50 }
  );
  const app = buildGroupApp([group]);

  it('returns 200', async () => {
    const res = await request(app).get('/api/groups/large-grp');
    expect(res.status).toBe(200);
  });

  it('fixture: all 20 members have contributed', () => {
    expect(contributionStates.every((s) => s.hasContributed)).toBe(true);
  });

  it('fixture: each transaction amount matches the group contribution amount', () => {
    for (const state of contributionStates) {
      expect(state.transaction!.amount).toBe(50);
    }
  });
});

// ── Zero-contribution group ───────────────────────────────────────────────────

describe('GET /api/groups — no contributions yet (start of cycle)', () => {
  const MEMBER_COUNT = 5;
  const { group, contributionStates, transactions } =
    GroupFixtureFactory.buildMixedContributionGroup(MEMBER_COUNT, 0, {
      id: 'empty-grp',
      name: 'New Cycle Group',
    });
  const app = buildGroupApp([group]);

  it('returns the group as Active', async () => {
    const res = await request(app).get('/api/groups/empty-grp');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('Active');
  });

  it('fixture: no contribution transactions exist', () => {
    expect(transactions).toHaveLength(0);
  });

  it('fixture: all members are marked as not-yet-contributed', () => {
    expect(contributionStates.every((s) => !s.hasContributed)).toBe(true);
  });
});

// ── Group list ────────────────────────────────────────────────────────────────

describe('GET /api/groups — list built with buildGroupList', () => {
  const LIST_SIZE = 10;
  const groups = GroupFixtureFactory.buildGroupList(LIST_SIZE, {
    contributionAmount: 150,
  });
  const app = buildGroupApp(groups);

  it('returns all groups', async () => {
    const res = await request(app).get('/api/groups');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(LIST_SIZE);
  });

  it('every group has a unique id', async () => {
    const res = await request(app).get('/api/groups');
    const ids: string[] = res.body.map((g: Group) => g.id);
    expect(new Set(ids).size).toBe(LIST_SIZE);
  });

  it('contributionAmount override is applied to every group', async () => {
    const res = await request(app).get('/api/groups');
    for (const group of res.body) {
      expect(group.contributionAmount).toBe(150);
    }
  });

  it('returns 404 for an id not in the list', async () => {
    const res = await request(app).get('/api/groups/nonexistent');
    expect(res.status).toBe(404);
  });
});

// ── id edge cases ─────────────────────────────────────────────────────────────

describe('GET /api/groups/:id — edge cases', () => {
  const { group } = GroupFixtureFactory.buildGroupWithMembers(2, { id: 'edge-001' });
  const app = buildGroupApp([group]);

  it('returns 200 for a valid id', async () => {
    const res = await request(app).get('/api/groups/edge-001');
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('edge-001');
  });

  it('returns 404 when the id has the correct prefix but wrong suffix', async () => {
    const res = await request(app).get('/api/groups/edge-002');
    expect(res.status).toBe(404);
  });

  it('returns 404 for a numeric id that does not exist', async () => {
    const res = await request(app).get('/api/groups/999999');
    expect(res.status).toBe(404);
  });
});
