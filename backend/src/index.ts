// ── Distributed tracing ───────────────────────────────────────────────────────
// MUST be the very first import so OpenTelemetry can patch instrumented libraries
// (express, http, pg, ioredis, …) before they are required. No-op when tracing
// is disabled (the default).
import { startTracing } from './tracing';
startTracing();

import fs from 'fs';
import http2 from 'http2';
import dotenv from 'dotenv';

dotenv.config();

import express from 'express';
import compression from 'compression';
import cors from 'cors';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { RecommendationEngine } from './recommendation';
import { EmailService } from './email_service';
import { ExportService } from './export_service';
import { BackupService, S3HttpClient } from './backup_service';
import { BackupScheduler } from './backup_scheduler';
import { RecoveryService } from './recovery_service';
import { BackupMonitor } from './backup_monitor';
import { ContractEventIndexer } from './contract_event_indexer';
import { WebPushService } from './web_push_service';
import { versionMiddleware } from './versioning';
import { createV1Router } from './routes/v1';
import { FeedbackService } from './feedback_service';
import { createV2Router } from './routes/v2';
import { metricsMiddleware, metricsHandler } from './metrics';
import { requestLogger } from './logger';
import { disconnectPrisma } from './prisma_client';
import { createRateLimiterMiddleware, createAuthRateLimiterMiddleware } from './rate_limiter';
import { createTieredRateLimiter, configureTier, setEndpointCost } from './redis_rate_limiter';
import { createQuotaReporterRouter } from './routes/quota_reporter';
import { createWebhookRouter } from './routes/webhooks';
import { getMemberReputation } from './reputation_service';
import { createAuthRouter } from './routes/auth';
import { createUserRouter } from './routes/user';
import { createRampRouter } from './routes/ramp';
import { createSep31Router } from './routes/sep31';
import { rampProtection } from './fiat_ramp_protection';
import { errorMiddleware, notFoundMiddleware } from './lib/errorMiddleware';
import { AuditEventLog, auditMiddleware, createAuditRouter } from './audit_event_log';
import { initWebSocketGateway } from './ws_gateway';
import { initReconciliationService } from './reconciliation_service';
import docsRouter from './docs';
import { IpfsClient, PinningService, GroupMetadataCache, IpfsMonitor } from './ipfs';
import { createIpfsRouter } from './routes/ipfs';

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

const app = express();
app.use(cors());
app.use(express.json());
app.use(compression());
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
app.use(createTieredRateLimiter());

// Stricter rate limiting on auth/admin endpoints: 10 req / 15 min per IP
const authRateLimiter = createAuthRateLimiterMiddleware();
app.use('/api/admin', authRateLimiter);
app.use('/graphql', authRateLimiter);

// ── CSP violation reporting ───────────────────────────────────────────────────
app.post('/api/csp-report', express.json({ type: ['application/json', 'application/csp-report'] }), (req, res) => {
  const report = req.body?.['csp-report'] ?? req.body;
  console.warn('[CSP Violation]', JSON.stringify(report));
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

  console.log(`  IPFS:       ${config.ipfs.apiUrl} (pinning enabled)`);
}

// ── Services ─────────────────────────────────────────────────────────────────
import { mockGroups, mockInteractions } from './mock_data';
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

const adminService = new AdminService();

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

// Start the contract event indexer
if (config.indexer.enabled) {
  eventIndexer.start().catch(console.error);
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

// Start keeper/relayer for automated payout execution (Issue #1026)
if (config.keeper.enabled) {
  startKeeperJob(config.keeper.schedule, config.indexer.contractId, config.stellar.rpcUrl);
}

const services = { engine, exportService, backupService, backupScheduler, recoveryService, backupMonitor, eventIndexer };

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
  console.log(`  IPFS API:   http://localhost:${PORT}/api/v1/ipfs`);
}

// ── Member reputation endpoint (Issue #800) ───────────────────────────────────
app.get('/api/members/:address/reputation', async (req, res) => {
  const { address } = req.params;
  if (!address || address.trim().length === 0) {
    return res.status(400).json({ error: 'address is required' });
  }
  try {
    const reputation = await getMemberReputation(address.trim());
    return res.json(reputation);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch reputation' });
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
  console.log(`API server running on port ${PORT}`);
  console.log(`  HTTP/2 enabled${hasTls ? ' (TLS)' : ' (h2c cleartext)'}.`);
  console.log(`  Versioned:  /api/v1/...  /api/v2/...`)
  console.log(`  Cache stats: http://localhost:${PORT}/api/cache/stats`);

  // Start fraud detection worker (Issue #1028)
  if (config.fraud.enabled) {
    await fraudDetectionWorker.start();
  }

  // ── Issue #2: WebSocket gateway for real-time event streaming ──────────────
  const wsGateway = initWebSocketGateway(server as any);
  console.log(`  WebSocket:  ws://localhost:${PORT}/ws?token=<jwt>`);

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
    console.log(`  Audit:      integrity verification every ${auditIntervalMs / 60000} min`);
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
    console.log(`  Reconciliation: drift check every ${parseInt(process.env.RECONCILIATION_INTERVAL_MS ?? String(15 * 60 * 1000)) / 60000} min`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  fraudDetectionWorker.stop();
  server.close();
  disconnectPrisma().catch(() => {});
});

export { app }; 