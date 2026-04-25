export const typeDefs = `#graphql
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
  }

  type Transaction {
    id: ID!
    groupId: String!
    memberAddress: String!
    amount: Float!
    type: TransactionType!
    timestamp: Float!
    stellarTxHash: String!
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
    # Groups
    groups: [Group!]!
    group(id: ID!): Group

    # Members
    members: [Member!]!
    member(id: ID!): Member

    # Transactions
    transactions(groupId: ID): [Transaction!]!
    transaction(id: ID!): Transaction

    # Recommendations
    recommendations(userId: ID!): RecommendationResult!

    # Search
    search(query: String!): SearchResult!

    # Health
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
