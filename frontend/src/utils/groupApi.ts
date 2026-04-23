/**
 * API utilities for group operations.
 * TODO: replace stubs with actual Soroban contract invocations.
 */

import type { GroupDetail, PublicGroup, GroupFilters } from '../types/group';

// Re-export so existing imports keep working
export type { PublicGroup, GroupDetail };

export interface GroupData {
  name: string;
  description: string;
  image_url: string;
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

export async function fetchGroups(filters?: Partial<GroupFilters>): Promise<PublicGroup[]> {
  // stub — TODO: replace with actual Soroban contract invocation
  void filters;
  return Promise.resolve([]);
}

export async function fetchGroup(groupId: string): Promise<DetailedGroup | null> {
  // stub — TODO: replace with actual Soroban contract invocation
  void groupId;
  return Promise.resolve(null);
}
