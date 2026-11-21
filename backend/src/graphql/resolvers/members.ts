import { paginateArray } from '@app/backend/lib/pagination';
import { mockGroups, mockMembers, mockTransactions } from '@app/backend/mock_data';

import type { OffsetParams } from '@app/backend/lib/pagination';
import type { Member } from '@app/backend/models';

export const memberResolvers = {
  Query: {
    members: (_: unknown, { limit, offset }: { limit?: number; offset?: number }) => {
      const params: OffsetParams = {
        limit: Math.min(100, Math.max(1, limit ?? 20)),
        offset: Math.max(0, offset ?? 0),
      };
      return paginateArray(mockMembers, params);
    },
    member: (_: unknown, { id }: { id: string }) => mockMembers.find((m) => m.id === id) ?? null,
  },

  Member: {
    groups: (member: Member) => mockGroups.filter((g) => member.groupIds.includes(g.id)),
    transactions: (member: Member) =>
      mockTransactions.filter((t) => t.memberAddress === member.address),
  },
};
