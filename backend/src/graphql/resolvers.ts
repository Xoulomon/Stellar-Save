import { Group, Member, Transaction, UserInteraction } from '../models';
import { RecommendationEngine } from '../recommendation';
import { ABTestingFramework } from '../ab_testing';

import { mockGroups, mockMembers, mockTransactions, mockInteractions } from '../mock_data';

const engine = new RecommendationEngine(mockGroups, mockInteractions);
const abTest  = new ABTestingFramework();

// ── Resolvers ─────────────────────────────────────────────────────────────────

export const resolvers = {
  Query: {
    health: () => 'ok',

    groups: () => mockGroups,
    group:  (_: unknown, { id }: { id: string }) =>
      mockGroups.find(g => g.id === id) ?? null,

    members: () => mockMembers,
    member:  (_: unknown, { id }: { id: string }) =>
      mockMembers.find(m => m.id === id) ?? null,

    transactions: (_: unknown, { groupId }: { groupId?: string }) =>
      groupId ? mockTransactions.filter(t => t.groupId === groupId) : mockTransactions,
    transaction: (_: unknown, { id }: { id: string }) =>
      mockTransactions.find(t => t.id === id) ?? null,

    recommendations: (_: unknown, { userId }: { userId: string }) => {
      const bucket = abTest.getBucket(userId);
      const algorithm = bucket === 'A' ? 'content' : 'collaborative';
      const recommendations = engine.getRecommendations(userId, algorithm as 'content' | 'collaborative');
      return { userId, bucket, algorithm, recommendations };
    },

    search: (_: unknown, { query }: { query: string }) => {
      const q = query.toLowerCase();
      return {
        groups:       mockGroups.filter(g => g.name.toLowerCase().includes(q) || g.tags.some(t => t.includes(q))),
        members:      mockMembers.filter(m => m.name.toLowerCase().includes(q) || m.address.toLowerCase().includes(q)),
        transactions: mockTransactions.filter(t => t.stellarTxHash.toLowerCase().includes(q) || t.memberAddress.toLowerCase().includes(q)),
      };
    },
  },

  Mutation: {
    setPreferences: (
      _: unknown,
      args: { userId: string; minContribution?: number; maxContribution?: number; preferredDuration?: number; tags: string[] }
    ) => {
      engine.setPreference({ userId: args.userId, tags: args.tags, ...args });
      return true;
    },
  },

  // ── Field resolvers (nested queries) ────────────────────────────────────────

  Group: {
    members:      (group: Group) => mockMembers.filter(m => m.groupIds.includes(group.id)),
    transactions: (group: Group) => mockTransactions.filter(t => t.groupId === group.id),
  },

  Member: {
    groups: (member: Member) => mockGroups.filter(g => member.groupIds.includes(g.id)),
  },

  Recommendation: {
    group: (rec: { groupId: string }) => mockGroups.find(g => g.id === rec.groupId) ?? null,
  },
};
