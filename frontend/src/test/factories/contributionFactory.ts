/**
 * Test factories for Contribution types.
 *
 * Covers `Contribution` from @stellar-save/sdk and `ContributionCycle`
 * from types/contribution.
 */

import type { Contribution } from '@stellar-save/sdk';
import type { ContributionCycle } from '../../types/contribution';
import { makeContributionCycleMember } from './memberFactory';

/**
 * Create a `Contribution` fixture (SDK type) with defaults.
 */
export function makeContribution(overrides?: Partial<Contribution>): Contribution {
  return {
    id: 'contrib-1',
    groupId: 'group-1',
    memberAddress: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHIJ',
    amount: 100,
    cycleNumber: 0,
    status: 'completed',
    timestamp: new Date('2026-01-20'),
    transactionHash: 'abc123hashdef456',
    ...overrides,
  };
}

/**
 * Create a `ContributionCycle` fixture with defaults.
 */
export function makeContributionCycle(
  overrides?: Partial<ContributionCycle>,
): ContributionCycle {
  return {
    cycleId: 0,
    deadline: new Date('2026-02-01'),
    totalMembers: 4,
    contributedCount: 3,
    members: [
      makeContributionCycleMember({ contributed: true }),
      makeContributionCycleMember({
        address: 'GDEF0987654321FEDCBAZYXWVUTSRQPONMLKJIHGFEDCBA0987654321FED',
        contributed: true,
      }),
      makeContributionCycleMember({
        address: 'GXYZ1111222233334444555566667777888899990000AAAABBBBCCCCDDDD',
        contributed: true,
      }),
      makeContributionCycleMember({
        address: 'GAAA5555666677778888999900001111222233334444555566667777AAAA',
        contributed: false,
      }),
    ],
    targetAmount: 400,
    ...overrides,
  };
}
