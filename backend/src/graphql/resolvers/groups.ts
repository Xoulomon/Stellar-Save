import { paginateArray } from '@app/backend/lib/pagination';
import { mockGroups, mockMembers, mockTransactions } from '@app/backend/mock_data';

import type { OffsetParams } from '@app/backend/lib/pagination';
import type { Group } from '@app/backend/models';

export const groupResolvers = {
  Query: {
    groups: (_: unknown, { limit, offset }: { limit?: number; offset?: number }) => {
      const params: OffsetParams = {
        limit: Math.min(100, Math.max(1, limit ?? 20)),
        offset: Math.max(0, offset ?? 0),
      };
      return paginateArray(mockGroups, params);
    },
    group: (_: unknown, { id }: { id: string }) => mockGroups.find((g) => g.id === id) ?? null,
  },

  Group: {
    members: (group: Group) => mockMembers.filter((m) => m.groupIds.includes(group.id)),
    transactions: (group: Group) => mockTransactions.filter((t) => t.groupId === group.id),
  },
};
