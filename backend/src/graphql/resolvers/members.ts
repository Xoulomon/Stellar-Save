import { paginateResults } from './shared';
import { mockGroups, mockMembers, mockTransactions } from '../../mock_data';

import type { Member } from '../../models';

export const memberResolvers = {
  Query: {
    members: (_: unknown, { limit, offset }: { limit?: number; offset?: number }) =>
      paginateResults(mockMembers, limit, offset),
    member: (_: unknown, { id }: { id: string }) => mockMembers.find((m) => m.id === id) ?? null,
  },

  Member: {
    groups: (member: Member) => mockGroups.filter((g) => member.groupIds.includes(g.id)),
    transactions: (member: Member) =>
      mockTransactions.filter((t) => t.memberAddress === member.address),
  },
};
