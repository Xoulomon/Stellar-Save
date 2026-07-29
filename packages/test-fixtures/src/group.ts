import type { ApiGroup, PublicGroupLike } from './types';

let apiGroupCounter = 0;

/** Backend-shaped group (matches backend/src/mock_data.ts mockGroups exactly). */
export function buildApiGroup(overrides: Partial<ApiGroup> = {}): ApiGroup {
  apiGroupCounter += 1;
  return {
    id: String(apiGroupCounter),
    name: `Test Group ${apiGroupCounter}`,
    contributionAmount: 100,
    cycleDuration: 604800,
    maxMembers: 10,
    currentMembers: 5,
    status: 'Active',
    tags: ['weekly'],
    ...overrides,
  };
}

/**
 * Canonical set of backend groups. Values intentionally match
 * backend/src/mock_data.ts's mockGroups so the two stay identical; the
 * contract test asserts this on every run.
 */
export const mockApiGroups: ApiGroup[] = [
  { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly', 'low-entry'] },
  { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly', 'high-entry'] },
  { id: '3', name: 'Student Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 5, currentMembers: 4, status: 'Active', tags: ['weekly', 'students'] },
];

let publicGroupCounter = 0;

/** Frontend view-model group (matches frontend/src/types/group.ts PublicGroup). */
export function buildPublicGroup(overrides: Partial<PublicGroupLike> = {}): PublicGroupLike {
  publicGroupCounter += 1;
  return {
    id: String(publicGroupCounter),
    name: `Test Group ${publicGroupCounter}`,
    description: 'A test savings group',
    memberCount: 5,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    cycleDuration: 7,
    ...overrides,
  };
}

export const mockPublicGroups: PublicGroupLike[] = [
  buildPublicGroup({ id: '1', name: 'Alpha Group', description: 'First group', memberCount: 5, contributionAmount: 100, status: 'active', createdAt: new Date('2024-01-01'), cycleDuration: 7 }),
  buildPublicGroup({ id: '2', name: 'Beta Group', description: 'Second group', memberCount: 10, contributionAmount: 200, status: 'pending', createdAt: new Date('2024-02-01'), cycleDuration: 14 }),
  buildPublicGroup({ id: '3', name: 'Gamma Group', memberCount: 3, contributionAmount: 50, status: 'completed', createdAt: new Date('2024-03-01'), cycleDuration: 30 }),
];
