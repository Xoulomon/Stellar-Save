import { RecommendationEngine } from '../recommendation';
import { Group, UserInteraction, UserPreference } from '../models';

async function runTests() {
  console.log('🧪 Running Recommendation Engine Tests...');

  const mockGroups: Group[] = [
    { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly'] },
    { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly'] },
  ];

  const mockInteractions: UserInteraction[] = [
    { userId: 'user1', groupId: '1', interactionType: 'join', timestamp: Date.now() },
    { userId: 'user2', groupId: '1', interactionType: 'join', timestamp: Date.now() },
    { userId: 'user2', groupId: '2', interactionType: 'join', timestamp: Date.now() },
  ];

  const engine = new RecommendationEngine(mockGroups, mockInteractions);

  // Test Content-based filtering
  console.log('Testing content-based filtering...');
  engine.setPreference({
    userId: 'user1',
    minContribution: 500,
    maxContribution: 1500,
    preferredDuration: 2592000,
    tags: ['monthly']
  });

  const contentRecs = engine.getRecommendations('user1', 'content');
  if (contentRecs.length > 0 && contentRecs[0].groupId === '2') {
    console.log('✅ Content-based filtering passed');
  } else {
    console.error('❌ Content-based filtering failed');
    process.exit(1);
  }

  // Test Collaborative filtering
  console.log('Testing collaborative filtering...');
  // user1 joined group 1. user2 joined group 1 and 2. 
  // user1 and user2 are similar (both joined 1).
  // user1 should be recommended group 2.
  const collabRecs = engine.getRecommendations('user1', 'collaborative');
  if (collabRecs.length > 0 && collabRecs[0].groupId === '2') {
    console.log('✅ Collaborative filtering passed');
  } else {
    console.error('❌ Collaborative filtering failed');
    process.exit(1);
  }

  console.log('ALL TESTS PASSED! 🎉');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
