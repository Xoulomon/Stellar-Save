import { RecommendationEngine } from '../../recommendation';
import { mockGroups, mockInteractions } from '../../mock_data';

const engine = new RecommendationEngine(mockGroups, mockInteractions);

export const recommendationResolvers = {
  Query: {
    recommendations: (_: unknown, { userId }: { userId: string }) => {
      const recommendations = engine.getRecommendations(userId, 'collaborative');
      return { userId, algorithm: 'collaborative', recommendations };
    },
  },

  Mutation: {
    setPreferences: (
      _: unknown,
      args: { userId: string; minContribution?: number; maxContribution?: number; preferredDuration?: number; tags: string[] }
    ) => {
      engine.setPreference(args);
      return true;
    },
  },

  RecommendationResult: {
    groups: (result: { recommendations: string[] }) =>
      mockGroups.filter(g => result.recommendations.includes(g.id)),
  },
};
