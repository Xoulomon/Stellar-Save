import { Transaction } from '../../models';
import { mockGroups, mockMembers, mockTransactions } from '../../mock_data';
import { paginateResults } from './shared';

export const transactionResolvers = {
  Query: {
    transactions: (
      _: unknown,
      { groupId, limit, offset }: { groupId?: string; limit?: number; offset?: number }
    ) => {
      const filtered = groupId
        ? mockTransactions.filter((t) => t.groupId === groupId)
        : mockTransactions;
      return paginateResults(filtered, limit, offset);
    },
    transaction: (_: unknown, { id }: { id: string }) =>
      mockTransactions.find((t) => t.id === id) ?? null,
  },

  Transaction: {
    group: (tx: Transaction) => mockGroups.find((g) => g.id === tx.groupId) ?? null,
    member: (tx: Transaction) => mockMembers.find((m) => m.address === tx.memberAddress) ?? null,
  },
};
