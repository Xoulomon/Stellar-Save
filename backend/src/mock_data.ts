import { Group, Member, Transaction, UserInteraction, AuditLog } from './models';

export const mockGroups: Group[] = [
  { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly', 'low-entry'] },
  { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly', 'high-entry'] },
  { id: '3', name: 'Student Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 5, currentMembers: 4, status: 'Active', tags: ['weekly', 'students'] },
];

export const mockMembers: Member[] = [
  { id: 'm1', name: 'Alice Johnson', address: 'G...ALICE', joinedAt: Date.now(), groupIds: ['1', '2'] },
  { id: 'm2', name: 'Bob Smith', address: 'G...BOB', joinedAt: Date.now(), groupIds: ['1'] },
  { id: 'm3', name: 'Charlie Davis', address: 'G...CHARLIE', joinedAt: Date.now(), groupIds: ['3'] },
];

export const mockTransactions: Transaction[] = [
  { id: 't1', groupId: '1', memberAddress: 'G...ALICE', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash1...' },
  { id: 't2', groupId: '1', memberAddress: 'G...BOB', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash2...' },
];

export const mockInteractions: UserInteraction[] = [
  { userId: 'user1', groupId: '1', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user1', groupId: '2', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user2', groupId: '1', interactionType: 'join', timestamp: Date.now() },
];

export const mockAuditLogs: AuditLog[] = [
  { id: 'log1', userId: 'admin1', action: 'LOGIN', timestamp: Date.now() },
  { id: 'log2', userId: 'admin1', action: 'VIEW_STATS', timestamp: Date.now() },
];
