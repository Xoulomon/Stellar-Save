import { Group, Member, Transaction, UserInteraction } from '../models';
import { RecommendationEngine } from '../recommendation';
import { ABTestingFramework } from '../ab_testing';

// ── Shared mock data (same source as REST layer) ──────────────────────────────

export const mockGroups: Group[] = [
  { id: '1', name: 'Weekly Savers',    contributionAmount: 100,  cycleDuration: 604800,  maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly', 'low-entry'] },
  { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly', 'high-entry'] },
  { id: '3', name: 'Student Circle',   contributionAmount: 50,   cycleDuration: 604800,  maxMembers: 5,  currentMembers: 4, status: 'Active', tags: ['weekly', 'students'] },
];

export const mockMembers: Member[] = [
  { id: 'm1', name: 'Alice Johnson', address: 'G...ALICE',   joinedAt: Date.now(), groupIds: ['1', '2'] },
  { id: 'm2', name: 'Bob Smith',     address: 'G...BOB',     joinedAt: Date.now(), groupIds: ['1'] },
  { id: 'm3', name: 'Charlie Davis', address: 'G...CHARLIE', joinedAt: Date.now(), groupIds: ['3'] },
];

export const mockTransactions: Transaction[] = [
  { id: 't1', groupId: '1', memberAddress: 'G...ALICE', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash1...' },
  { id: 't2', groupId: '1', memberAddress: 'G...BOB',   amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash2...' },
];

const mockInteractions: UserInteraction[] = [
  { userId: 'user1', groupId: '1', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user1', groupId: '2', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user2', groupId: '1', interactionType: 'join', timestamp: Date.now() },
];

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
