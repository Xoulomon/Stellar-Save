import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RecommendationEngine } from './recommendation';
import { ABTestingFramework } from './ab_testing';
import { Group, UserInteraction, UserPreference, Member, Transaction } from './models';
import { EmailService } from './email_service';
import { ExportService } from './export_service';
import { BackupService, S3HttpClient } from './backup_service';
import { BackupScheduler } from './backup_scheduler';
import { RecoveryService } from './recovery_service';
import { BackupMonitor } from './backup_monitor';
import { AdminService } from './admin_service';
import { adminAuthMiddleware, AuthenticatedRequest } from './auth_middleware';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// ── GraphQL ───────────────────────────────────────────────────────────────────
const schema = makeExecutableSchema({ typeDefs, resolvers });
const apolloServer = new ApolloServer({
  schema,
  validationRules,
  introspection: true,
});

// Apollo must be started before attaching middleware
apolloServer.start().then(() => {
  // Playground: GET /graphql returns Apollo Sandbox redirect
  app.get('/graphql', (_req, res) => {
    res.send(`
      <!DOCTYPE html><html><head><title>GraphQL Playground</title></head><body>
      <script>window.location.href = 'https://studio.apollographql.com/sandbox/explorer?endpoint=' + encodeURIComponent(window.location.origin + '/graphql');</script>
      </body></html>
    `);
  });

  app.use('/graphql', expressMiddleware(apolloServer, {
    context: async () => ({}),
  }));
});

const PORT = process.env.PORT || 3001;

import { mockGroups, mockMembers, mockTransactions, mockInteractions } from './mock_data';

const engine = new RecommendationEngine(mockGroups, mockInteractions);
const abTest = new ABTestingFramework();
const emailService = new EmailService();
const exportService = new ExportService(
  emailService,
  engine.getInteractions(),
  engine.getPreferences()
);

// Backup system
const s3Client = new S3HttpClient();
const backupService = new BackupService(s3Client);
const backupScheduler = new BackupScheduler(backupService);
const recoveryService = new RecoveryService(backupService, s3Client);
const backupMonitor = new BackupMonitor(backupService, {
  alertWebhookUrl: process.env.BACKUP_ALERT_WEBHOOK_URL,
});

const adminService = new AdminService();

if (process.env.BACKUP_ENABLED === 'true') {
  backupScheduler.start();
  backupMonitor.start();
}

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

// ── Backup Routes ────────────────────────────────────────────────────────────

/**
 * @api {post} /backup Trigger a manual backup
 * Body: { type: 'full' | 'incremental' }
 */
app.post('/backup', async (req, res) => {
  const { type } = req.body;
  if (type !== 'full' && type !== 'incremental') {
    return res.status(400).json({ error: 'type must be "full" or "incremental"' });
  }
  const job = await backupScheduler.triggerManual(type);
  res.status(202).json(job);
});

/**
 * @api {get} /backup List all backup jobs
 */
app.get('/backup', (_req, res) => {
  res.json(backupService.listJobs());
});

/**
 * @api {get} /backup/:jobId Get a specific backup job
 */
app.get('/backup/:jobId', (req, res) => {
  const job = backupService.getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Backup job not found' });
  res.json(job);
});

/**
 * @api {post} /backup/restore Restore from a backup
 * Body: { jobId?: string }  — omit jobId to restore latest
 */
app.post('/backup/restore', async (req, res) => {
  try {
    const result = req.body.jobId
      ? await recoveryService.restore(req.body.jobId)
      : await recoveryService.restoreLatest();
    res.json(result);
  } catch (err: unknown) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

/**
 * @api {get} /backup/alerts Get backup alerts
 * Query: unacknowledgedOnly=true
 */
app.get('/backup/alerts', (req, res) => {
  const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
  res.json(backupMonitor.getAlerts(unacknowledgedOnly));
});

/**
 * @api {post} /backup/alerts/:alertId/acknowledge Acknowledge an alert
 */
app.post('/backup/alerts/:alertId/acknowledge', (req, res) => {
  const ok = backupMonitor.acknowledge(req.params.alertId);
  if (!ok) return res.status(404).json({ error: 'Alert not found' });
  res.json({ acknowledged: true });
});

// ── Admin Routes ────────────────────────────────────────────────────────────

const adminRouter = express.Router();
adminRouter.use(adminAuthMiddleware);

/**
 * @api {get} /admin/stats Get platform statistics
 */
adminRouter.get('/stats', (req, res) => {
  res.json(adminService.getPlatformStats());
});

/**
 * @api {get} /admin/users List all users
 */
adminRouter.get('/users', (req, res) => {
  res.json(adminService.getUsers());
});

/**
 * @api {get} /admin/users/:id Get user details
 */
adminRouter.get('/users/:id', (req, res) => {
  const user = adminService.getUserById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

/**
 * @api {patch} /admin/users/:id Update user details
 */
adminRouter.patch('/users/:id', (req: AuthenticatedRequest, res) => {
  const user = adminService.updateUser(req.params.id, req.body, req.adminId!);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

/**
 * @api {delete} /admin/users/:id Delete user
 */
adminRouter.delete('/users/:id', (req: AuthenticatedRequest, res) => {
  const success = adminService.deleteUser(req.params.id, req.adminId!);
  if (!success) return res.status(404).json({ error: 'User not found' });
  res.json({ message: 'User deleted' });
});

/**
 * @api {get} /admin/audit-logs Get audit logs
 */
adminRouter.get('/audit-logs', (req, res) => {
  res.json(adminService.getAuditLogs());
});

app.use('/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`Recommendation Engine running on port ${PORT}`);
});
