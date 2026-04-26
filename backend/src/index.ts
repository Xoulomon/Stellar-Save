import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RecommendationEngine } from './recommendation';
import { ABTestingFramework } from './ab_testing';
import { Group, UserInteraction } from './models';
import { EmailService } from './email_service';
import { ExportService } from './export_service';
import { BackupService, S3HttpClient } from './backup_service';
import { BackupScheduler } from './backup_scheduler';
import { RecoveryService } from './recovery_service';
import { BackupMonitor } from './backup_monitor';
import { versionMiddleware } from './versioning';
import { createV1Router } from './routes/v1';
import { createV2Router } from './routes/v2';

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

// ── Mock Data ────────────────────────────────────────────────────────────────
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

// ── Services ─────────────────────────────────────────────────────────────────
const engine = new RecommendationEngine(mockGroups, mockInteractions);
const abTest = new ABTestingFramework();
const emailService = new EmailService();
const exportService = new ExportService(emailService, engine.getInteractions(), engine.getPreferences());
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

const services = { engine, abTest, exportService, backupService, backupScheduler, recoveryService, backupMonitor };

// ── Versioned API routes ──────────────────────────────────────────────────────
app.use('/api', versionMiddleware);
app.use('/api/v1', createV1Router(services));
app.use('/api/v2', createV2Router(services));

// ── Legacy unversioned routes (redirect to v1 for backward compatibility) ────
app.use((req, res, next) => {
  const legacyPaths = ['/health', '/recommendations', '/preferences', '/export', '/backup', '/search'];
  if (legacyPaths.some(p => req.path.startsWith(p))) {
    res.setHeader('X-API-Deprecation-Notice', 'Unversioned paths are deprecated. Use /api/v1/...');
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', '2027-01-01');
  }
  next();
});
app.use('/', createV1Router(services));

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
  console.log(`API server running on port ${PORT}`);
  console.log(`  Versioned:  /api/v1/...  /api/v2/...`);
  console.log(`  Legacy:     /health  /recommendations  etc. (deprecated)`);
});

export { app };
