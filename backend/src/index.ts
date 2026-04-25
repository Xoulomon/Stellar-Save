import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { RecommendationEngine } from './recommendation';
import { ABTestingFramework } from './ab_testing';
import { Group, UserInteraction, UserPreference } from './models';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// Mock Data
const mockGroups: Group[] = [
  { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly', 'low-entry'] },
  { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly', 'high-entry'] },
  { id: '3', name: 'Student Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 5, currentMembers: 4, status: 'Active', tags: ['weekly', 'students'] },
];

const mockInteractions: UserInteraction[] = [
  { userId: 'user1', groupId: '1', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user1', groupId: '2', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user2', groupId: '1', interactionType: 'join', timestamp: Date.now() },
];

const engine = new RecommendationEngine(mockGroups, mockInteractions);
const abTest = new ABTestingFramework();

// API Endpoints

/**
 * @api {post} /preferences Collect user preference data
 */
app.post('/preferences', (req, res) => {
  const pref: UserPreference = req.body;
  if (!pref.userId) {
    return res.status(400).json({ error: 'userId is required' });
  }
  engine.setPreference(pref);
  res.status(200).json({ message: 'Preferences updated' });
});

/**
 * @api {get} /recommendations/:userId Get recommended groups
 */
app.get('/recommendations/:userId', (req, res) => {
  const { userId } = req.params;
  const bucket = abTest.getBucket(userId);
  
  // A/B Test: Bucket A gets content-based, Bucket B gets collaborative
  const algorithm = bucket === 'A' ? 'content' : 'collaborative';
  const recommendations = engine.getRecommendations(userId, algorithm);
  
  res.json({
    userId,
    bucket,
    algorithm,
    recommendations
  });
});

/**
 * @api {get} /health Health check
 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Recommendation Engine running on port ${PORT}`);
});
