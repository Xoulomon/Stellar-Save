/**
 * Test factories for Group types.
 *
 * Eliminates inline object literals and provides typed partial overrides.
 */

import type { GroupDetail, PublicGroup } from '../../types/group';

/**
 * Create a `PublicGroup` fixture with defaults. Override any field via `overrides`.
 */
export function makePublicGroup(overrides?: Partial<PublicGroup>): PublicGroup {
  return {
    id: 'group-1',
    name: 'Test Savers Circle',
    memberCount: 5,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    cycleDuration: 7,
    ...overrides,
  };
}

/**
 * Create a `GroupDetail` fixture with defaults. Override any field via `overrides`.
 */
export function makeGroup(overrides?: Partial<GroupDetail>): GroupDetail {
  return {
    id: 'group-1',
    name: 'Test Savers Circle',
    description: 'A test group for savings',
    memberCount: 5,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    cycleDuration: 604800, // 1 week in seconds
    maxMembers: 10,
    minMembers: 2,
    currentCycle: 0,
    isActive: true,
    started: true,
    startedAt: new Date('2026-01-15'),
    creator: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
    ...overrides,
  };
}
