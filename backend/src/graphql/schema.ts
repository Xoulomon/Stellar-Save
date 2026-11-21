import { makeExecutableSchema } from '@graphql-tools/schema';

import { typeDefs as commonTypeDefs } from './resolvers/common';
import { typeDefs as groupTypeDefs, resolvers as groupResolvers } from './resolvers/groups';
import { typeDefs as memberTypeDefs, resolvers as memberResolvers } from './resolvers/members';
import {
  typeDefs as transactionTypeDefs,
  resolvers as transactionResolvers,
} from './resolvers/transactions';
import {
  typeDefs as recommendationTypeDefs,
  resolvers as recommendationResolvers,
} from './resolvers/recommendations';
import { typeDefs as searchTypeDefs, resolvers as searchResolvers } from './resolvers/search';
import { typeDefs as healthTypeDefs, resolvers as healthResolvers } from './resolvers/health';
import {
  typeDefs as preferencesTypeDefs,
  resolvers as preferencesResolvers,
} from './resolvers/preferences';

export { complexityRules } from './complexity';

/**
 * Per-domain SDL fragments. Each domain module owns its own types and the
 * fields it contributes to the root `Query`/`Mutation` types.
 */
export const typeDefs = [
  commonTypeDefs,
  groupTypeDefs,
  memberTypeDefs,
  transactionTypeDefs,
  recommendationTypeDefs,
  searchTypeDefs,
  healthTypeDefs,
  preferencesTypeDefs,
];

/**
 * Per-domain resolver maps, merged into a single resolver map.
 */
export const resolvers = {
  Query: {
    ...groupResolvers.Query,
    ...memberResolvers.Query,
    ...transactionResolvers.Query,
    ...recommendationResolvers.Query,
    ...searchResolvers.Query,
    ...healthResolvers.Query,
  },
  Mutation: {
    ...preferencesResolvers.Mutation,
  },
  Group: groupResolvers.Group,
  Member: memberResolvers.Member,
  Transaction: transactionResolvers.Transaction,
  Recommendation: recommendationResolvers.Recommendation,
};

/**
 * Executable schema composed from the per-domain fragments and resolvers.
 * The resulting schema surface is identical to the previous monolithic SDL.
 */
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});
