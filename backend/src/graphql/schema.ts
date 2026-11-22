import { makeExecutableSchema } from '@graphql-tools/schema';

import { validationRules } from './complexity';
import { resolvers } from './resolvers';

export { validationRules as complexityRules };

export const typeDefs = `#graphql
  type PaginationInfo {
    limit: Int!
    offset: Int!
    total: Int!
    hasMore: Boolean!
  }

  type Group {
    id: ID!
    name: String!
    contributionAmount: Float!
    cycleDuration: Int!
    maxMembers: Int!
    currentMembers: Int!
    status: String!
    tags: [String!]!
    members: [Member!]!
    transactions: [Transaction!]!
  }

  type Member {
    id: ID!
    address: String!
    name: String!
    joinedAt: Float!
    groupIds: [String!]!
    groups: [Group!]!
    transactions: [Transaction!]!
  }

  type Transaction {
    id: ID!
    groupId: String!
    memberAddress: String!
    amount: Float!
    type: TransactionType!
    timestamp: Float!
    stellarTxHash: String!
    group: Group
    member: Member
  }

  type Recommendation {
    groupId: String!
    score: Float!
    algorithm: String!
    group: Group
  }

  type RecommendationResult {
    userId: String!
    bucket: String!
    algorithm: String!
    recommendations: [Recommendation!]!
    groups: [Group!]!
  }

  type SearchResult {
    groups: [Group!]!
    members: [Member!]!
    transactions: [Transaction!]!
  }

  enum TransactionType {
    contribution
    payout
  }

  type Query {
    groups(limit: Int, offset: Int): [Group!]!
    group(id: ID!): Group
    members(limit: Int, offset: Int): [Member!]!
    member(id: ID!): Member
    transactions(groupId: ID, limit: Int, offset: Int): [Transaction!]!
    transaction(id: ID!): Transaction
    recommendations(userId: ID!): RecommendationResult!
    search(query: String!): SearchResult!
    health: String!
  }

  type Mutation {
    setPreferences(
      userId: ID!
      minContribution: Float
      maxContribution: Float
      preferredDuration: Int
      tags: [String!]!
    ): Boolean!
  }
`;

export const schema = makeExecutableSchema({ typeDefs, resolvers });
