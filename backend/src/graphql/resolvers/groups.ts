import { Group } from '../../models';
import { mockGroups, mockMembers, mockTransactions } from '../../mock_data';
import { paginateResults } from './shared';

export const groupResolvers = {
  Query: {
    groups: (_: unknown, { limit, offset }: { limit?: number; offset?: number }) =>
      paginateResults(mockGroups, limit, offset),
    group: (_: unknown, { id }: { id: string }) =>
      mockGroups.find(g => g.id === id) ?? null,
  },

  Group: {
    members: (group: Group) => mockMembers.filter(m => m.groupIds.includes(group.id)),
    transactions: (group: Group) => mockTransactions.filter(t => t.groupId === group.id),
  },
};
