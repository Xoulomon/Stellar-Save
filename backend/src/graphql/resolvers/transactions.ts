import { paginateArray } from '@app/backend/lib/pagination';
import { mockGroups, mockMembers, mockTransactions } from '@app/backend/mock_data';

import type { OffsetParams } from '@app/backend/lib/pagination';
import type { Transaction } from '@app/backend/models';

export const transactionResolvers = {
  Query: {
    transactions: (
      _: unknown,
      { groupId, limit, offset }: { groupId?: string; limit?: number; offset?: number }
    ) => {
      const filtered = groupId
        ? mockTransactions.filter((t) => t.groupId === groupId)
        : mockTransactions;

      const params: OffsetParams = {
        limit: Math.min(100, Math.max(1, limit ?? 20)),
        offset: Math.max(0, offset ?? 0),
      };

      return paginateArray(filtered, params);
    },
    transaction: (_: unknown, { id }: { id: string }) =>
      mockTransactions.find((t) => t.id === id) ?? null,
  },

  Transaction: {
    group: (tx: Transaction) => mockGroups.find((g) => g.id === tx.groupId) ?? null,
    member: (tx: Transaction) => mockMembers.find((m) => m.address === tx.memberAddress) ?? null,
  },
};
