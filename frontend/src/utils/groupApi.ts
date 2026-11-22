/**
 * API utilities for group operations.
 * TODO: replace stubs with actual Soroban contract invocations.
 *
 * Mock data is loaded lazily only when VITE_USE_MOCKS=true.  In production
 * the mocks/ module is never imported and will be tree-shaken from the bundle.
 */

import type { GroupDetail, PublicGroup, GroupFilters } from '../types/group';

export type { PublicGroup, GroupDetail };
export type {
  GroupRepository,
  GroupData,
  DetailedGroup,
  GroupMember,
  GroupContribution,
  GroupCycle,
} from '../lib/groupRepository';
export { StubGroupRepository } from '../lib/groupRepository';

import type { DetailedGroup } from '../lib/groupRepository';

export interface GroupData {
  name: string;
  description: string;
  image_url: string;
  contribution_amount: number;
  cycle_duration: number;
  max_members: number;
  min_members: number;
  insuranceEnabled: boolean;
  insurancePremiumRate: number;
}

export async function createGroup(data: GroupData): Promise<string> {
  void data;
  // TODO: replace with Soroban contract invocation
  return Promise.resolve('');
}

export interface DetailedGroup extends PublicGroup {
  totalMembers: number;
  targetAmount: number;
  currentAmount: number;
  contributionFrequency: 'daily' | 'weekly' | 'monthly';
  members: GroupMember[];
  contributions: GroupContribution[];
  cycles: GroupCycle[];
  currentCycle?: GroupCycle;
}

export interface GroupMember {
  id: string;
  address: string;
  name?: string;
  joinedAt: Date;
  totalContributions: number;
  isActive: boolean;
}

export interface GroupContribution {
  id: string;
  memberId: string;
  memberName?: string;
  amount: number;
  timestamp: Date;
  transactionHash: string;
  status: 'completed' | 'pending' | 'failed';
}

export interface GroupCycle {
  cycleNumber: number;
  startDate: Date;
  endDate: Date;
  targetAmount: number;
  currentAmount: number;
  status: 'active' | 'completed' | 'upcoming';
}

// ── Mock gate ─────────────────────────────────────────────────────────────────

const USE_MOCKS = import.meta.env['VITE_USE_MOCKS'] === 'true';

export async function fetchGroups(filters?: Partial<GroupFilters>): Promise<PublicGroup[]> {
  void filters;

  if (USE_MOCKS) {
    // Lazily import so the mock module is excluded from production bundles
    const { MOCK_GROUPS } = await import('../mocks/groupsMockData');
    await new Promise((r) => setTimeout(r, 600));
    return MOCK_GROUPS;
  }

  // TODO: replace with actual Soroban/Horizon contract invocation
  return [];
}

export async function fetchGroup(groupId: string): Promise<DetailedGroup | null> {
  if (USE_MOCKS) {
    const { MOCK_GROUPS } = await import('../mocks/groupsMockData');
    await new Promise((r) => setTimeout(r, 600));

    const group = MOCK_GROUPS.find((g) => g.id === groupId);
    if (!group) return null;

    const now = new Date();
    const members: GroupMember[] = [
      { id: '1', address: 'GABC1234567890ABCDEF', name: 'Alice', joinedAt: new Date('2026-01-10'), totalContributions: 750, isActive: true },
      { id: '2', address: 'GDEF0987654321FEDCBA', name: 'Bob', joinedAt: new Date('2026-01-12'), totalContributions: 500, isActive: true },
      { id: '3', address: 'GXYZ1111222233334444', name: 'Carol', joinedAt: new Date('2026-01-15'), totalContributions: 250, isActive: true },
      { id: '4', address: 'GAAA5555666677778888', name: 'Dave', joinedAt: new Date('2026-02-01'), totalContributions: 250, isActive: false },
    ];

    return {
      ...group,
      totalMembers: members.length,
      targetAmount: group.memberCount * group.contributionAmount * 10,
      currentAmount: members.reduce((sum, m) => sum + m.totalContributions, 0),
      contributionFrequency: 'monthly',
      members,
      contributions: [
        { id: 'c1', memberId: '1', memberName: 'Alice', amount: group.contributionAmount, timestamp: new Date(now.getTime() - 86400000 * 2), transactionHash: 'tx_abc123', status: 'completed' },
        { id: 'c2', memberId: '2', memberName: 'Bob', amount: group.contributionAmount, timestamp: new Date(now.getTime() - 86400000 * 3), transactionHash: 'tx_def456', status: 'completed' },
        { id: 'c3', memberId: '3', memberName: 'Carol', amount: group.contributionAmount, timestamp: new Date(now.getTime() - 86400000 * 5), transactionHash: 'tx_ghi789', status: 'completed' },
        { id: 'c4', memberId: '4', memberName: 'Dave', amount: group.contributionAmount, timestamp: new Date(now.getTime() - 86400000 * 7), transactionHash: 'tx_jkl012', status: 'pending' },
      ],
      cycles: [
        { cycleNumber: 1, startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), targetAmount: group.memberCount * group.contributionAmount, currentAmount: group.memberCount * group.contributionAmount, status: 'completed' },
        { cycleNumber: 2, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), targetAmount: group.memberCount * group.contributionAmount, currentAmount: group.memberCount * group.contributionAmount * 0.75, status: 'active' },
      ],
      currentCycle: { cycleNumber: 2, startDate: new Date('2026-02-01'), endDate: new Date('2026-02-28'), targetAmount: group.memberCount * group.contributionAmount, currentAmount: group.memberCount * group.contributionAmount * 0.75, status: 'active' },
    };
  }

  const now = new Date();
  const members: GroupMember[] = [
    {
      id: '1',
      address: 'GABC1234567890ABCDEF',
      name: 'Alice',
      joinedAt: new Date('2026-01-10'),
      totalContributions: 750,
      isActive: true,
    },
    {
      id: '2',
      address: 'GDEF0987654321FEDCBA',
      name: 'Bob',
      joinedAt: new Date('2026-01-12'),
      totalContributions: 500,
      isActive: true,
    },
    {
      id: '3',
      address: 'GXYZ1111222233334444',
      name: 'Carol',
      joinedAt: new Date('2026-01-15'),
      totalContributions: 250,
      isActive: true,
    },
    {
      id: '4',
      address: 'GAAA5555666677778888',
      name: 'Dave',
      joinedAt: new Date('2026-02-01'),
      totalContributions: 250,
      isActive: false,
    },
  ];

  return {
    ...group,
    totalMembers: members.length,
    targetAmount: group.memberCount * group.contributionAmount * 10, // Example target amount
    currentAmount: members.reduce((sum, m) => sum + m.totalContributions, 0),
    contributionFrequency: 'monthly', // Mock frequency
    members,
    contributions: [
      {
        id: 'c1',
        memberId: '1',
        memberName: 'Alice',
        amount: group.contributionAmount,
        timestamp: new Date(now.getTime() - 86400000 * 2),
        transactionHash: 'tx_abc123',
        status: 'completed',
      },
      {
        id: 'c2',
        memberId: '2',
        memberName: 'Bob',
        amount: group.contributionAmount,
        timestamp: new Date(now.getTime() - 86400000 * 3),
        transactionHash: 'tx_def456',
        status: 'completed',
      },
      {
        id: 'c3',
        memberId: '3',
        memberName: 'Carol',
        amount: group.contributionAmount,
        timestamp: new Date(now.getTime() - 86400000 * 5),
        transactionHash: 'tx_ghi789',
        status: 'completed',
      },
      {
        id: 'c4',
        memberId: '4',
        memberName: 'Dave',
        amount: group.contributionAmount,
        timestamp: new Date(now.getTime() - 86400000 * 7),
        transactionHash: 'tx_jkl012',
        status: 'pending',
      },
    ],
    cycles: [
      {
        cycleNumber: 1,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-01-31'),
        targetAmount: group.memberCount * group.contributionAmount,
        currentAmount: group.memberCount * group.contributionAmount,
        status: 'completed',
      },
      {
        cycleNumber: 2,
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-02-28'),
        targetAmount: group.memberCount * group.contributionAmount,
        currentAmount: group.memberCount * group.contributionAmount * 0.75,
        status: 'active',
      },
    ],
    currentCycle: {
      cycleNumber: 2,
      startDate: new Date('2026-02-01'),
      endDate: new Date('2026-02-28'),
      targetAmount: group.memberCount * group.contributionAmount,
      currentAmount: group.memberCount * group.contributionAmount * 0.75,
      status: 'active',
    },
  };
}
