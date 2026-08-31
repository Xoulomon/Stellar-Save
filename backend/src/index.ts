// ── Distributed tracing ───────────────────────────────────────────────────────
// MUST be the very first import so OpenTelemetry can patch instrumented libraries
// (express, http, pg, ioredis, …) before they are required. No-op when tracing
// is disabled (the default). Deliberately out of import/order's alphabetical
// sort for this reason -- do not let `eslint --fix` reorder it.
// eslint-disable-next-line import/order
import { startTracing } from './tracing';
startTracing();

import fs from 'fs';
import http2 from 'http2';


dotenv.config();

import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';

import { AuditEventLog, auditMiddleware, createAuditRouter } from './audit_event_log';
import { BackupMonitor } from './backup_monitor';
import { BackupRestoreDrill } from './backup_restore_drill';
import { BackupScheduler } from './backup_scheduler';
import { BackupService, S3HttpClient } from './backup_service';
import { ContractEventIndexer } from './contract_event_indexer';
import docsRouter from './docs';
import { EmailService } from './email_service';
import { ExportService } from './export_service';
import { FeedbackService } from './feedback_service';
import { rampProtection } from './fiat_ramp_protection';
import { createGracefulShutdown } from './graceful_shutdown';
import { IpfsClient, PinningService, GroupMetadataCache, IpfsMonitor } from './ipfs';
import { errorMiddleware, notFoundMiddleware } from './lib/errorMiddleware';
import { AppError } from './lib/errors';
import { requestLogger, logger, errFields } from './logger';
import { metricsMiddleware, metricsHandler } from './metrics';
import { requestId } from './middleware/requestId';
import { mockGroups, mockInteractions } from './mock_data';
import { disconnectPrisma, prisma } from './prisma_client';
import { createAuthRateLimiterMiddleware } from './rate_limiter';
import { RecommendationEngine } from './recommendation';
import { initReconciliationService } from './reconciliation_service';
import { RecoveryService } from './recovery_service';
import { createTieredRateLimiter, configureTier, setEndpointCost } from './redis_rate_limiter';
import { getMemberReputation } from './reputation_service';
import { createAuthRouter } from './routes/auth';
import { createHealthRouter, createDatabaseCheck, createRpcCheck } from './routes/health';
import { createIpfsRouter } from './routes/ipfs';
import { createQuotaReporterRouter } from './routes/quota_reporter';
import { createRampRouter } from './routes/ramp';
import { createSep31Router } from './routes/sep31';
import { createUserRouter } from './routes/user';
import { createV1Router } from './routes/v1';
import { createV2Router } from './routes/v2';
import { createWebhookRouter } from './routes/webhooks';
import { versionMiddleware } from './versioning';
import { WebPushService } from './web_push_service';
import { initWebSocketGateway } from './ws_gateway';

const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' https://cdn.jsdelivr.net/npm/stellar-sdk",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self' https://horizon-testnet.stellar.org https://soroban-testnet.stellar.org https://horizon.stellar.org",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "report-uri /api/csp-report",
].join('; ');

// ── Global middleware chain (order matters) ──────────────────────────────────
// 1. cors            — must run before any response is written
// 2. express.json     — parse bodies before anything reads req.body
// 3. compression      — compress responses after body parsing
// 4. requestId        — attach/propagate x-correlation-id + async context
// 5. requestLogger    — log requests as they arrive
// 6. metricsMiddleware — record request metrics
// 7. auditMiddleware  — tamper-evident audit log for state-changing operations
const app = express();
app.use(cors());
app.use(express.json());
app.use(compression());
app.use(requestId);
app.use(requestLogger);
app.use(metricsMiddleware);
// Tamper-evident audit log for all state-changing operations (Issue #1)
app.use(auditMiddleware);

// CSP middleware — applied to all responses
app.use((_req, res, next) => {
  res.setHeader('Content-Security-Policy', CSP_POLICY);
  next();
});

configureTier('free', [
  { windowMs: 60_000, max: config.rateLimiting.free.perMin, label: '1m' },
  { windowMs: 3_600_000, max: config.rateLimiting.free.perHour, label: '1h' },
]);
configureTier('pro', [
  { windowMs: 60_000, max: config.rateLimiting.pro.perMin, label: '1m' },
  { windowMs: 3_600_000, max: config.rateLimiting.pro.perHour, label: '1h' },
]);
configureTier('enterprise', [
  { windowMs: 60_000, max: config.rateLimiting.enterprise.perMin, label: '1m' },
  { windowMs: 3_600_000, max: config.rateLimiting.enterprise.perHour, label: '1h' },
]);

setEndpointCost('/api/v1/health', 1, 'read');
setEndpointCost('/api/v1/ready', 1, 'read');
setEndpointCost('/api/v1/stats', 1, 'read');
setEndpointCost('/api/v1/search', 5, 'read');
setEndpointCost('/api/v1/export', 10, 'write');
setEndpointCost('/api/v1/analytics', 5, 'read');
setEndpointCost('/api/ramp/deposit', 10, 'sensitive');
setEndpointCost('/api/ramp/withdraw', 10, 'sensitive');
setEndpointCost('/api/ramp/:id/status', 5, 'read');
setEndpointCost('/api/kyc/submit', 10, 'sensitive');
setEndpointCost('/api/admin', 5, 'admin');
setEndpointCost('/graphql', 2, 'read');

app.get('/metrics', metricsHandler);

// ── Operational probes (Issue #1514) ─────────────────────────────────────────
// Mounted ahead of the rate limiter so an orchestrator's probes can never be
// throttled into a false unhealthy verdict.
app.use(
  createHealthRouter({
    checkDatabase: createDatabaseCheck(prisma),
    checkRpc: createRpcCheck(config.stellar.rpcUrl),
  }),
);

app.use(createTieredRateLimiter());

// Stricter rate limiting on auth/admin endpoints: 10 req / 15 min per IP (Issue #1507)
// Prevents brute-force attacks on authentication and admin operations.
const authRateLimiter = createAuthRateLimiterMiddleware();
app.use('/api/admin', authRateLimiter);
app.use('/graphql', authRateLimiter);
app.use('/api/auth', authRateLimiter);

// ── CSP violation reporting ───────────────────────────────────────────────────
app.post('/api/csp-report', express.json({ type: ['application/json', 'application/csp-report'] }), (req, res) => {
  const report = req.body?.['csp-report'] ?? req.body;
  logger.warn('[CSP Violation]', { report: JSON.stringify(report) });
  res.status(204).end();
});

// ========== CACHE ROUTES (Issue #563) ==========

// Cache statistics endpoint - monitor cache hit rates
app.get('/api/cache/stats', async (req, res) => {
  const stats = await getCacheStats();
  res.json(stats);
});

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

const PORT = config.port;

// ── IPFS Services ────────────────────────────────────────────────────────────
let ipfsClient: IpfsClient | undefined;
let pinningService: PinningService | undefined;
let metadataCache: GroupMetadataCache | undefined;
let ipfsMonitor: IpfsMonitor | undefined;

if (config.ipfs.enabled) {
  ipfsClient = new IpfsClient(config.ipfs.apiUrl, config.ipfs.apiTimeoutMs);
  pinningService = new PinningService(ipfsClient);
  metadataCache = new GroupMetadataCache(ipfsClient, pinningService);
  ipfsMonitor = new IpfsMonitor(ipfsClient, pinningService, config.ipfs.monitorIntervalMs);

  pinningService.start();
  ipfsMonitor.start();

  logger.info('IPFS pinning enabled', { ipfs_api_url: config.ipfs.apiUrl });
}

// ── Services ─────────────────────────────────────────────────────────────────
const engine = new RecommendationEngine(mockGroups, mockInteractions);
const emailService = new EmailService();
const exportService = new ExportService(emailService, engine.getInteractions(), engine.getPreferences());
const s3Client = new S3HttpClient();
const backupService = new BackupService(s3Client);
const backupScheduler = new BackupScheduler(backupService);
const recoveryService = new RecoveryService(backupService, s3Client);
const backupMonitor = new BackupMonitor(backupService, {
  alertWebhookUrl: config.backup.alertWebhookUrl,
});
const backupRestoreDrill = new BackupRestoreDrill(backupService, s3Client, {
  checkIntervalMs: config.backup.drillIntervalMs,
  maxRestoreDurationMs: config.backup.drillMaxDurationMs,
  alertWebhookUrl: config.backup.alertWebhookUrl,
});
const feedbackService = new FeedbackService(prisma);

new AdminService();

const webPushService = new WebPushService();

const eventIndexer = new ContractEventIndexer(
  config.indexer.horizonUrl,
  config.indexer.contractId,
  config.database.url,
  webPushService
);

if (config.backup.enabled) {
  backupScheduler.start();
  backupMonitor.start();
}

if (config.backup.drillEnabled) {
  backupRestoreDrill.start();
}

// Start the contract event indexer
if (config.indexer.enabled) {
  eventIndexer.start().catch((error) => logger.error('event indexer failed to start', errFields(error)));
}

// Start on-chain anomaly monitor
if (config.onChainMonitor.enabled) {
  const onChainMonitor = new OnChainMonitor({
    largePayoutThresholdStroops: config.onChainMonitor.largePayoutThresholdStroops,
  });
  onChainMonitor.start();
}

// Start analytics resync job if enabled
if (config.analyticsResync.enabled) {
  startAnalyticsResyncJob(config.analyticsResync.schedule);
}

// Start keeper/relayer for automated payout execution (Issue #1026, #1305)
if (config.keeper.enabled) {
  const stellarClient = new StellarClient(config.stellar.rpcUrl);
  startKeeperJob(config.keeper.schedule, config.indexer.contractId, stellarClient, prisma);
}

const services = {
  engine,
  exportService,
  backupService,
  backupScheduler,
  recoveryService,
  backupMonitor,
  backupRestoreDrill,
  eventIndexer,
  feedbackService,
};

// ── Auth routes (public — no JWT required) ───────────────────────────────────
app.use('/api/auth', createAuthRouter());

// ── API Documentation routes ──────────────────────────────────────────────────
app.use(docsRouter);

// ── User routes (JWT protected) ───────────────────────────────────────────────
app.use('/api/user', createUserRouter());

// ── KYC routes (Issue #1024) ──────────────────────────────────────────────────
app.use('/api/kyc', createKycRouter());

// ── Fiat ramp routes (strict rate limiting + CAPTCHA gate + KYC gate) ──────────
app.use('/api/ramp', rampProtection(), createRampRouter());

// ── SEP-31 cross-border routes (Issue #1025) ──────────────────────────────────
app.use('/api/sep31', createSep31Router());

// ── Versioned API routes ──────────────────────────────────────────────────────
app.use('/api', versionMiddleware);
app.use('/api/v1', createV1Router(services));
app.use('/api/v2', createV2Router(services));
app.use('/api/webhooks', createWebhookRouter());
app.use('/api/v1/costs', createCostRouter());
app.use('/api/v1/rate-limits', createQuotaReporterRouter());

// ── IPFS routes ──────────────────────────────────────────────────────────────
if (ipfsClient && pinningService && metadataCache && ipfsMonitor) {
  app.use(
    '/api/v1/ipfs',
    createIpfsRouter(ipfsClient, pinningService, metadataCache, ipfsMonitor),
  );
  logger.info('IPFS API mounted', { path: `/api/v1/ipfs`, port: PORT });
}

// ── Member reputation endpoint (Issue #800) ───────────────────────────────────
app.get('/api/members/:address/reputation', async (req, res, next) => {
  const { address } = req.params;
  if (!address || address.trim().length === 0) {
    return next(new AppError('VALIDATION_ERROR', 'address is required', 400));
  }
  try {
    const reputation = await getMemberReputation(address.trim());
    return res.json(reputation);
  } catch (error) {
    logger.error('Failed to fetch reputation', { address, error: String(error) });
    return next(new AppError('FETCH_FAILED', 'Failed to fetch reputation', 500));
  }
});

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

// ── Admin audit-log routes (Issue #1 — event-sourcing audit log) ──────────────
app.use('/api/admin/audit-log', createAuditRouter());

// ── Error handling (must be last) ─────────────────────────────────────────────
app.use(notFoundMiddleware);
app.use(errorMiddleware);

const hasTls = Boolean(config.tls.keyPath && config.tls.certPath);
const server = hasTls
  ? http2.createSecureServer(
      {
        key: fs.readFileSync(config.tls.keyPath as string),
        cert: fs.readFileSync(config.tls.certPath as string),
        allowHTTP1: true,
      },
      app
    )
  : http2.createServer({ allowHTTP1: true }, app);

server.listen(PORT, async () => {
  logger.info('API server running', {
    port: PORT,
    http2: true,
    tls: hasTls,
    versioned: '/api/v1/... /api/v2/...',
  });

  // Start fraud detection worker (Issue #1028)
  if (config.fraud.enabled) {
    await fraudDetectionWorker.start();
  }

  // ── Issue #2: WebSocket gateway for real-time event streaming ──────────────
  const wsGateway = initWebSocketGateway(server as any);
  logger.info('WebSocket gateway ready', { path: '/ws', port: PORT });

  // Patch the ContractEventIndexer to publish events to the WS gateway
  // after each indexed event.  We do this post-init to avoid circular deps.
  const origStoreEvent = (eventIndexer as any).storeEvent?.bind(eventIndexer);
  if (origStoreEvent) {
    (eventIndexer as any).storeEvent = async (event: any) => {
      await origStoreEvent(event);
      // Publish to WebSocket subscribers
      try {
        const data = event.data ?? {};
        wsGateway.publishContractEvent({
          contractId: event.contractId || event.contract_id || '',
          eventType: event.type || event.eventType || 'unknown',
          data,
          txHash: event.transactionHash || event.txHash || '',
          ledgerSeq: event.ledger || event.ledgerSeq || 0,
          timestamp: event.createdAt ? new Date(event.createdAt) : new Date(),
        });
      } catch { /* non-blocking */ }
    };
  }

  // ── Issue #1: Start audit chain integrity verification job ────────────────
  if (process.env.AUDIT_VERIFY_ENABLED !== 'false') {
    const auditIntervalMs = parseInt(process.env.AUDIT_VERIFY_INTERVAL_MS ?? String(60 * 60 * 1000));
    AuditEventLog.startVerificationJob(auditIntervalMs);
    logger.info('audit integrity verification job started', { interval_min: auditIntervalMs / 60000 });
  }

  // ── Issue #3: Start reconciliation service ────────────────────────────────
  if (process.env.RECONCILIATION_ENABLED === 'true') {
    const reconciliation = initReconciliationService({
      contractId: process.env.CONTRACT_ID ?? '',
      sampleSize: parseInt(process.env.RECONCILIATION_SAMPLE_SIZE ?? '50'),
      driftThreshold: parseInt(process.env.RECONCILIATION_DRIFT_THRESHOLD ?? '3'),
      intervalMs: parseInt(process.env.RECONCILIATION_INTERVAL_MS ?? String(15 * 60 * 1000)),
    });
    reconciliation.start();
    logger.info('reconciliation service started', {
      interval_min: parseInt(process.env.RECONCILIATION_INTERVAL_MS ?? String(15 * 60 * 1000)) / 60000,
    });
  }
});

// Graceful shutdown: stop accepting new connections, let in-flight requests
// finish within a timeout, then close DB connections before exiting.
const gracefulShutdown = createGracefulShutdown(server, async () => {
  fraudDetectionWorker.stop();
  await disconnectPrisma();
}, { timeoutMs: parseInt(process.env.SHUTDOWN_TIMEOUT_MS ?? '10000', 10) });

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app };
