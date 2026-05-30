/**
 * API utilities for group operations.
 * TODO: replace stubs with actual Soroban contract invocations.
 */

import type { GroupDetail, PublicGroup, GroupFilters } from '../types/group';

export type { PublicGroup, GroupDetail };

export interface GroupData {
  name: string;
  description: string;
  image_url: string;
  contribution_amount: number;
  cycle_duration: number;
  max_members: number;
  min_members: number;
}

export async function createGroup(data: GroupData): Promise<string> {
  void data;
  return Promise.resolve('mock-group-id');
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

// Mock dataset - swap with real Soroban/Horizon fetch when ready
const MOCK_GROUPS: PublicGroup[] = [
  {
    id: '1',
    name: 'Family Savings Circle',
    description: 'A trusted circle for family members to save together monthly.',
    memberCount: 8,
    contributionAmount: 500,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-10'),
    cycleDuration: 30,
  },
  {
    id: '2',
    name: 'Vacation Fund 2026',
    description: 'Saving up for a group holiday. Join before spots fill up!',
    memberCount: 5,
    contributionAmount: 250,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-02-01'),
    cycleDuration: 14,
  },
  {
    id: '3',
    name: 'Business Startup Pool',
    description: 'Entrepreneurs pooling capital for early-stage ventures.',
    memberCount: 10,
    contributionAmount: 1000,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-20'),
    cycleDuration: 30,
  },
  {
    id: '4',
    name: 'Emergency Reserve',
    description: 'Community emergency fund for unexpected expenses.',
    memberCount: 12,
    contributionAmount: 300,
    currency: 'XLM',
    status: 'completed',
    createdAt: new Date('2025-09-01'),
    cycleDuration: 7,
  },
  {
    id: '5',
    name: 'Tech Workers Ajo',
    description: 'Monthly savings circle for tech professionals.',
    memberCount: 6,
    contributionAmount: 750,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-03-01'),
    cycleDuration: 30,
  },
  {
    id: '6',
    name: 'Diaspora Savings Group',
    description: 'Connecting the African diaspora through community savings.',
    memberCount: 15,
    contributionAmount: 200,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-02-15'),
    cycleDuration: 14,
  },
  {
    id: '7',
    name: 'Student Housing Fund',
    description: 'Students saving together for housing deposits.',
    memberCount: 4,
    contributionAmount: 150,
    currency: 'XLM',
    status: 'pending',
    createdAt: new Date('2026-04-01'),
    cycleDuration: 7,
  },
  {
    id: '8',
    name: 'Market Traders Circle',
    description: 'Local market traders pooling resources for stock.',
    memberCount: 9,
    contributionAmount: 400,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-01-05'),
    cycleDuration: 7,
  },
  {
    id: '9',
    name: 'Healthcare Workers Pool',
    description: 'Savings group for healthcare professionals.',
    memberCount: 7,
    contributionAmount: 600,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-03-10'),
    cycleDuration: 30,
  },
  {
    id: '10',
    name: 'Women Entrepreneurs Fund',
    description: 'Empowering women-led businesses through collective savings.',
    memberCount: 11,
    contributionAmount: 350,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2026-02-20'),
    cycleDuration: 14,
  },
  {
    id: '11',
    name: 'Retired Teachers Circle',
    description: 'Supplemental savings for retired educators.',
    memberCount: 8,
    contributionAmount: 200,
    currency: 'XLM',
    status: 'completed',
    createdAt: new Date('2025-06-01'),
    cycleDuration: 30,
  },
  {
    id: '12',
    name: 'Youth Savings Initiative',
    description: 'Teaching young adults financial discipline through group savings.',
    memberCount: 3,
    contributionAmount: 100,
    currency: 'XLM',
    status: 'pending',
    createdAt: new Date('2026-04-10'),
    cycleDuration: 7,
  },
];

export async function fetchGroups(filters?: Partial<GroupFilters>): Promise<PublicGroup[]> {
  // TODO: replace with actual Soroban contract invocation
  void filters;
  await new Promise((r) => setTimeout(r, 600));
  return MOCK_GROUPS;
}

export async function fetchGroup(groupId: string): Promise<DetailedGroup | null> {
  // TODO: replace with actual Soroban contract invocation
  await new Promise((r) => setTimeout(r, 600)); // Simulate network delay

  const group = MOCK_GROUPS.find((g) => g.id === groupId);
  if (!group) {
    return null;
  }

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
    targetAmount: group.memberCount * group.contributionAmount * 10, // Example target amount
    currentAmount: members.reduce((sum, m) => sum + m.totalContributions, 0),
    contributionFrequency: 'monthly', // Mock frequency
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
