/**
 * API utilities for group operations.
 * TODO: replace stubs with actual Soroban contract invocations.
 */

import { GroupDetail, PublicGroup, GroupFilters } from '../types/group';

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
  return new Promise((resolve) => setTimeout(() => resolve('mock-group-id'), 1000));
}

// Generate some mock groups for the browse page
const generateMockGroups = (): PublicGroup[] => {
  const groups: PublicGroup[] = [];
  const statuses: ('active' | 'starting_soon' | 'completed')[] = ['active', 'starting_soon', 'completed'];
  const durations: ('short-term' | 'long-term')[] = ['short-term', 'long-term'];

  for (let i = 1; i <= 30; i++) {
    groups.push({
      id: `group-${i}`,
      name: `Savings Pool ${i}`,
      description: `Description for savings pool ${i}. Join us to save together and grow your wealth on the Stellar network.`,
      memberCount: Math.floor(Math.random() * 20) + 2,
      contributionAmount: [10, 50, 100, 500, i * 10][i % 5],
      currency: 'XLM',
      status: statuses[i % 3],
      duration: durations[i % 2],
      createdAt: new Date(Date.now() - i * 86400000),
    });
  }
  return groups;
};

const MOCK_GROUPS = generateMockGroups();

export async function fetchGroups(filters?: GroupFilters): Promise<PublicGroup[]> {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 600));

  let result = [...MOCK_GROUPS];

  if (filters) {
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));
    }
    if (filters.status && filters.status !== 'all') {
      result = result.filter(g => g.status === filters.status);
    }
    if (filters.duration && filters.duration !== 'all') {
      result = result.filter(g => g.duration === filters.duration);
    }
    if (filters.minAmount) {
      result = result.filter(g => g.contributionAmount >= Number(filters.minAmount));
    }
    if (filters.maxAmount) {
      result = result.filter(g => g.contributionAmount <= Number(filters.maxAmount));
    }
  }

  return Promise.resolve(result);
}

export async function fetchGroup(groupId: string): Promise<GroupDetail> {
  // stub — TODO: replace with actual Soroban contract invocation
  await new Promise((resolve) => setTimeout(resolve, 400));
  
  const baseGroup = MOCK_GROUPS.find(g => g.id === groupId) || MOCK_GROUPS[0];

  return Promise.resolve({
    ...baseGroup,
    creator: 'GA...' + Math.random().toString(16).slice(2, 10).toUpperCase(),
    cycleDuration: baseGroup.duration === 'short-term' ? 604800 : 2592000,
    maxMembers: 50,
    minMembers: 5,
    currentCycle: 1,
    isActive: baseGroup.status === 'active',
    started: baseGroup.status !== 'starting_soon',
    startedAt: baseGroup.status !== 'starting_soon' ? new Date(baseGroup.createdAt) : null,
  });
}

export async function joinGroup(groupId: string): Promise<{ success: boolean }> {
  // Simulate API call
  await new Promise((resolve) => setTimeout(resolve, 1500));
  console.log(`Joined group ${groupId}`);
  return Promise.resolve({ success: true });
}
