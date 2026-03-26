/**
 * API utilities for group operations.
 * TODO: replace stubs with actual Soroban contract invocations.
 */

import type { PublicGroup, GroupFilters } from '../types/group';

// Re-export so existing imports keep working
export type { PublicGroup };

export interface GroupData {
  name: string;
  description: string;
  contribution_amount: number; // stroops = XLM * 10_000_000
  cycle_duration: number;      // seconds
  max_members: number;
  min_members: number;
}

export async function createGroup(data: GroupData): Promise<string> {
  // stub — returns a mock group ID
  void data;
  return Promise.resolve('mock-group-id');
}

export interface PublicGroup {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  contributionAmount: number; // in XLM
  currency: string;
  status: 'active' | 'completed' | 'pending';
  createdAt: Date;
}

export interface DetailedGroup extends PublicGroup {
  // Additional detailed information
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

export async function fetchGroups(): Promise<PublicGroup[]> {
  // stub — TODO: replace with actual Soroban contract invocation
  return Promise.resolve([]);
}

export async function fetchGroup(groupId: string): Promise<DetailedGroup> {
  // stub — TODO: replace with actual Soroban contract invocation
  // Mock data for development
  const mockGroup: DetailedGroup = {
    id: groupId,
    name: `Savings Group ${groupId.slice(-4)}`,
    description: 'A community savings group focused on building financial security through regular contributions and transparent payouts.',
    memberCount: 12,
    contributionAmount: 50,
    currency: 'XLM',
    status: 'active',
    createdAt: new Date('2024-01-15'),
    totalMembers: 12,
    targetAmount: 600,
    currentAmount: 450,
    contributionFrequency: 'monthly',
    members: [
      {
        id: '1',
        address: 'GA1234567890123456789012345678901234567890',
        name: 'Alice Johnson',
        joinedAt: new Date('2024-01-15'),
        totalContributions: 200,
        isActive: true,
      },
      {
        id: '2',
        address: 'GB1234567890123456789012345678901234567890',
        name: 'Bob Smith',
        joinedAt: new Date('2024-01-20'),
        totalContributions: 150,
        isActive: true,
      },
      {
        id: '3',
        address: 'GC1234567890123456789012345678901234567890',
        joinedAt: new Date('2024-02-01'),
        totalContributions: 100,
        isActive: true,
      },
    ],
    contributions: [
      {
        id: 'c1',
        memberId: '1',
        memberName: 'Alice Johnson',
        amount: 50,
        timestamp: new Date('2024-03-01'),
        transactionHash: 'tx1234567890',
        status: 'completed',
      },
      {
        id: 'c2',
        memberId: '2',
        memberName: 'Bob Smith',
        amount: 50,
        timestamp: new Date('2024-03-01'),
        transactionHash: 'tx1234567891',
        status: 'completed',
      },
    ],
    cycles: [
      {
        cycleNumber: 1,
        startDate: new Date('2024-01-15'),
        endDate: new Date('2024-02-15'),
        targetAmount: 600,
        currentAmount: 600,
        status: 'completed',
      },
      {
        cycleNumber: 2,
        startDate: new Date('2024-02-15'),
        endDate: new Date('2024-03-15'),
        targetAmount: 600,
        currentAmount: 450,
        status: 'active',
      },
    ],
    currentCycle: {
      cycleNumber: 2,
      startDate: new Date('2024-02-15'),
      endDate: new Date('2024-03-15'),
      targetAmount: 600,
      currentAmount: 450,
      status: 'active',
    },
  };

  return Promise.resolve(mockGroup);
}
