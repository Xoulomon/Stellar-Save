import { UserPreference, Group, UserInteraction, Recommendation } from './models';

export class RecommendationEngine {
  private groups: Group[] = [];
  private interactions: UserInteraction[] = [];
  private preferences: Map<string, UserPreference> = new Map();

  constructor(groups: Group[], interactions: UserInteraction[]) {
    this.groups = groups;
    this.interactions = interactions;
  }

  setPreference(preference: UserPreference) {
    this.preferences.set(preference.userId, preference);
  }

  getInteractions(): UserInteraction[] {
    return this.interactions;
  }

  getPreferences(): Map<string, UserPreference> {
    return this.preferences;
  }

  getRecommendations(userId: string, algorithm: 'content' | 'collaborative'): Recommendation[] {
    if (algorithm === 'content') {
      return this.getContentBasedRecommendations(userId);
    } else {
      return this.getCollaborativeRecommendations(userId);
    }
  }

  private getContentBasedRecommendations(userId: string): Recommendation[] {
    const pref = this.preferences.get(userId);
    if (!pref) return [];

    return this.groups
      .map(group => {
        let score = 0;

        // Contribution amount score
        if (pref.minContribution && group.contributionAmount >= pref.minContribution) score += 1;
        if (pref.maxContribution && group.contributionAmount <= pref.maxContribution) score += 1;

        // Duration score
        if (pref.preferredDuration && Math.abs(group.cycleDuration - pref.preferredDuration) < 86400 * 7) {
          score += 2; // Close to preferred duration (within a week)
        }

        // Tags score
        const matchingTags = group.tags.filter(tag => pref.tags.includes(tag));
        score += matchingTags.length * 0.5;

        return { groupId: group.id, score, algorithm: 'content' };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score);
  }

  private getCollaborativeRecommendations(userId: string): Recommendation[] {
    // Simplified User-Based Collaborative Filtering
    const userGroups = new Set(
      this.interactions
        .filter(i => i.userId === userId && i.interactionType === 'join')
        .map(i => i.groupId)
    );

    const otherUsers = Array.from(new Set(this.interactions.map(i => i.userId))).filter(id => id !== userId);

    const recommendations = new Map<string, number>();

    otherUsers.forEach(otherId => {
      const otherGroups = new Set(
        this.interactions
          .filter(i => i.userId === otherId && i.interactionType === 'join')
          .map(i => i.groupId)
      );

      // Calculate Jaccard Similarity
      const intersection = new Set([...userGroups].filter(id => otherGroups.has(id)));
      const union = new Set([...userGroups, ...otherGroups]);
      const similarity = union.size === 0 ? 0 : intersection.size / union.size;

      if (similarity > 0) {
        otherGroups.forEach(groupId => {
          if (!userGroups.has(groupId)) {
            const currentScore = recommendations.get(groupId) || 0;
            recommendations.set(groupId, currentScore + similarity);
          }
        });
      }
    });

    return Array.from(recommendations.entries())
      .map(([groupId, score]) => ({ groupId, score, algorithm: 'collaborative' }))
      .sort((a, b) => b.score - a.score);
  }
}
