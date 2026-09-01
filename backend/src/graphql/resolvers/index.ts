import { groupResolvers } from './groups';
import { memberResolvers } from './members';
import { recommendationResolvers } from './recommendations';
import { searchResolvers } from './search';
import { transactionResolvers } from './transactions';

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
