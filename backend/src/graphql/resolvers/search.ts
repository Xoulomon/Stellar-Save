import { mockGroups, mockMembers, mockTransactions } from '../../mock_data';

export const searchResolvers = {
  Query: {
    search: (_: unknown, { query }: { query: string }) => {
      const q = query.toLowerCase();
      return {
        groups:       mockGroups.filter(g => g.name.toLowerCase().includes(q) || g.tags.some(t => t.includes(q))),
        members:      mockMembers.filter(m => m.name.toLowerCase().includes(q) || m.address.toLowerCase().includes(q)),
        transactions: mockTransactions.filter(t => t.stellarTxHash.toLowerCase().includes(q) || t.memberAddress.toLowerCase().includes(q)),
      };
    },
  },
};
