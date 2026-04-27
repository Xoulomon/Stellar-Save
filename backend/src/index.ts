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
import { metricsMiddleware, metricsHandler } from './metrics';
import { requestLogger } from './logger';
import { createRateLimiterMiddleware } from './rate_limiter';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(requestLogger);
app.use(metricsMiddleware);
app.get('/metrics', metricsHandler);
app.use(createRateLimiterMiddleware());

// ========== CACHE ROUTES (Issue #563) ==========

// Cache statistics endpoint - monitor cache hit rates
app.get('/api/cache/stats', async (req, res) => {
  const stats = await getCacheStats();
  res.json(stats);
});

// Example cached endpoint for retirements
app.get('/api/retirements', cacheMiddleware(60), async (req, res) => {
  res.json({ 
    data: 'Retirements data - cached for 60 seconds', 
    timestamp: new Date(),
    source: 'database'
  });
});

// Write endpoint that invalidates cache
app.post('/api/retirements', async (req, res) => {
  await clearCache('/api/retirements');
  res.json({ 
    success: true, 
    message: 'Retirement created, cache cleared',
    timestamp: new Date()
  });
});

// Cached stats endpoint
app.get('/api/stats', cacheMiddleware(3600), async (req, res) => {
  res.json({
    totalRetired: 1000,
    totalTransactions: 45,
    timestamp: new Date(),
    source: 'database'
  });
});

// Start cache warming job (preloads popular data)
startWarmingJob();

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

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`  Versioned:  /api/v1/...  /api/v2/...`);
  console.log(`  Legacy:     /health  /recommendations  etc. (deprecated)`);
  console.log(`  Cache stats: http://localhost:${PORT}/api/cache/stats`);
});

export { app }; 