import { groupResolvers } from './groups';
import { memberResolvers } from './members';
import { transactionResolvers } from './transactions';
import { recommendationResolvers } from './recommendations';
import { searchResolvers } from './search';

export const resolvers = {
  Query: {
    health: () => 'ok',
    ...groupResolvers.Query,
    ...memberResolvers.Query,
    ...transactionResolvers.Query,
    ...recommendationResolvers.Query,
    ...searchResolvers.Query,
  },

  Mutation: {
    ...recommendationResolvers.Mutation,
  },

  Group: groupResolvers.Group,
  Member: memberResolvers.Member,
  Transaction: transactionResolvers.Transaction,
  RecommendationResult: recommendationResolvers.RecommendationResult,
};
