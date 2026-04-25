import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { RecommendationEngine } from './recommendation';
import { ABTestingFramework } from './ab_testing';
import { Group, UserInteraction, UserPreference } from './models';
import { EmailService } from './email_service';
import { ExportService } from './export_service';

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

const mockMembers: Member[] = [
  { id: 'm1', name: 'Alice Johnson', address: 'G...ALICE', joinedAt: Date.now(), groupIds: ['1', '2'] },
  { id: 'm2', name: 'Bob Smith', address: 'G...BOB', joinedAt: Date.now(), groupIds: ['1'] },
  { id: 'm3', name: 'Charlie Davis', address: 'G...CHARLIE', joinedAt: Date.now(), groupIds: ['3'] },
];

const mockTransactions: Transaction[] = [
  { id: 't1', groupId: '1', memberAddress: 'G...ALICE', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash1...' },
  { id: 't2', groupId: '1', memberAddress: 'G...BOB', amount: 100, type: 'contribution', timestamp: Date.now(), stellarTxHash: 'hash2...' },
];

const mockInteractions: UserInteraction[] = [
  { userId: 'user1', groupId: '1', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user1', groupId: '2', interactionType: 'join', timestamp: Date.now() },
  { userId: 'user2', groupId: '1', interactionType: 'join', timestamp: Date.now() },
];

const engine = new RecommendationEngine(mockGroups, mockInteractions);
const abTest = new ABTestingFramework();
const emailService = new EmailService();
const exportService = new ExportService(
  emailService,
  engine.getInteractions(),
  engine.getPreferences()
);

// API Endpoints

/**
 * @api {get} /search Search across groups, members, and transactions
 */
app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  try {
    const results = await searchService.globalSearch(q as string);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

/**
 * @api {get} /search/autocomplete Get autocomplete suggestions
 */
app.get('/search/autocomplete', async (req, res) => {
  const { q } = req.query;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter q is required' });
  }
  try {
    const suggestions = await searchService.autocomplete(q as string);
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: 'Autocomplete failed' });
  }
});

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

/**
 * @api {post} /export Trigger data export
 */
app.post('/export', async (req, res) => {
  const { userId, email, format } = req.body;
  if (!userId || !email || !format) {
    return res.status(400).json({ error: 'userId, email, and format are required' });
  }
  
  if (format !== 'CSV' && format !== 'JSON') {
    return res.status(400).json({ error: 'Invalid format. Use CSV or JSON' });
  }

  const jobId = await exportService.createJob(userId, email, format);
  res.status(202).json({ jobId, message: 'Export job created' });
});

/**
 * @api {get} /export/:jobId Get export status
 */
app.get('/export/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = exportService.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  res.json(job);
});

/**
 * @api {get} /export/:jobId/download Download export file
 */
app.get('/export/:jobId/download', (req, res) => {
  const { jobId } = req.params;
  const job = exportService.getJob(jobId);
  
  if (!job) {
    return res.status(404).json({ error: 'Job not found' });
  }
  
  if (job.status !== 'completed') {
    return res.status(400).json({ error: 'Job is not completed yet' });
  }
  
  res.json({ url: job.fileUrl });
});

app.listen(PORT, () => {
  console.log(`Recommendation Engine running on port ${PORT}`);
});
