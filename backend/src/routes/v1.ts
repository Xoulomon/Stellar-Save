import { Router, Request, Response, NextFunction } from 'express';
import { format as fastCsvFormat } from 'fast-csv';

import { RecommendationEngine } from '../recommendation';
import { EmailService } from '../email_service';
import { ExportService } from '../export_service';
import { parseOffsetParams, parseCursorParams, paginate, paginateArray, paginateCursorArray } from '../lib/pagination';
import { BackupService, S3HttpClient } from '../backup_service';
import { BackupScheduler } from '../backup_scheduler';
import { RecoveryService } from '../recovery_service';
import { BackupMonitor } from '../backup_monitor';
import { BackupRestoreDrill } from '../backup_restore_drill';
import { ContractEventIndexer } from '../contract_event_indexer';
import { AnalyticsService } from '../analytics_service';
import { FeedbackService } from '../feedback_service';
import { createAnalyticsMiddlewareStack, createAnalyticsCacheMiddleware } from '../analytics_middleware';
import { Group, UserInteraction, UserPreference } from '../models';
import { toContractEventDTO } from '../dto';
import { createNotificationRouter } from './notifications';
import { createSseRouter } from './sse';
import { createInsuranceRouter } from './insurance';
import { createGovernanceRouter } from './governance';
import { adminAuthMiddleware } from '../auth_middleware';
import { apiKeyService } from '../api_key_service';
import { apiKeyAuthMiddleware, recordApiUsage } from '../api_key_rate_limiter';
import { AdminService } from '../admin_service';
import { logger } from '../logger';
import { AppError } from '../lib/errors';
import { validateBody, validateQuery, schemas } from '../lib/validation';

// ── Shared service instances (passed in from app) ────────────────────────────
export interface V1Services {
  engine: RecommendationEngine;
  exportService: ExportService;
  backupService: BackupService;
  backupScheduler: BackupScheduler;
  recoveryService: RecoveryService;
  backupMonitor: BackupMonitor;
  backupRestoreDrill: BackupRestoreDrill;
  eventIndexer: ContractEventIndexer;
  analyticsService: AnalyticsService;
  feedbackService: FeedbackService;
}

export function createV1Router(services: V1Services): Router {
  const router = Router();
  const {
    engine,
    exportService,
    backupService,
    backupScheduler,
    recoveryService,
    backupMonitor,
    backupRestoreDrill,
    eventIndexer,
    analyticsService,
    feedbackService,
  } = services;

  // Setup analytics middleware
  const analyticsMiddleware = createAnalyticsMiddlewareStack();
  // 5-minute cache specifically for the landing page stats endpoint
  const statsGroupsCache = createAnalyticsCacheMiddleware(300);

  // ── Landing Page Stats ────────────────────────────────────────────────────
  // GET /stats/groups — platform-wide group statistics for the landing page.
  // Aggregates from the indexed ContractEvent database; cached 5 min in Redis.
  router.get(
    '/stats/groups',
    analyticsMiddleware.readRateLimit,
    statsGroupsCache,
    async (_req, res, next) => {
      try {
        const stats = await analyticsService.getGroupsOverviewStats();
        res.json(stats);
      } catch (error) {
        logger.error('Error fetching groups overview stats', { error: String(error) });
        next(new AppError('STATS_FETCH_FAILED', 'Failed to fetch group statistics', 500));
      }
    }
  );

  // Notifications (web push subscriptions, preferences, templates)
  router.use('/notifications', createNotificationRouter());

  // SSE event stream (Issue #1011)
  router.use('/events', createSseRouter(eventIndexer));

  // Insurance pool (Issue #1012)
  router.use('/groups/:groupId/insurance', createInsuranceRouter());

  // Governance proposals (Issue #1013)
  router.use('/governance', createGovernanceRouter());

  // Search
  router.get('/search', async (req, res, next) => {
    const { q } = req.query;
    if (!q) return next(new AppError('VALIDATION_ERROR', 'Query parameter q is required', 400));
    try {
      const { SearchService } = await import('../search');
      const searchService = new SearchService();
      res.json(await searchService.globalSearch(q as string));
    } catch (error) {
      logger.error('Search failed', { error: String(error) });
      next(new AppError('SEARCH_FAILED', 'Search failed', 500));
    }
  });

  router.get('/search/autocomplete', async (req, res, next) => {
    const { q } = req.query;
    if (!q) return next(new AppError('VALIDATION_ERROR', 'Query parameter q is required', 400));
    try {
      const { SearchService } = await import('../search');
      const searchService = new SearchService();
      res.json(await searchService.autocomplete(q as string));
    } catch (error) {
      logger.error('Autocomplete failed', { error: String(error) });
      next(new AppError('SEARCH_FAILED', 'Autocomplete failed', 500));
    }
  });

  // Preferences
  router.post('/preferences', (req, res, next) => {
    const pref: UserPreference = req.body;
    if (!pref.userId) return next(new AppError('VALIDATION_ERROR', 'userId is required', 400));
    engine.setPreference(pref);
    res.status(200).json({ message: 'Preferences updated' });
  });

  // Recommendations
  router.get('/recommendations/:userId', (req, res) => {
    const { userId } = req.params;
    const recommendations = engine.getRecommendations(userId, 'collaborative');
    res.json({ userId, algorithm: 'collaborative', recommendations });
  });

  // Health
  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      version: 'v1',
    });
  });

  // Ready
  router.get('/ready', async (req, res) => {
    const requestStart = Date.now();

    const [database, horizon, cache] = await Promise.all([
      eventIndexer.readinessCheckDatabase(),
      eventIndexer.readinessCheckHorizon(),
      readinessCheckCache(),
    ]);

    const responseTimeMs = Date.now() - requestStart;
    const up = database.up && horizon.up && cache.up;

    res.status(up ? 200 : 503).json({
      status: up ? 'ready' : 'not_ready',
      version: 'v1',
      responseTimeMs,
      dependencies: {
        database,
        horizon,
        cache,
      },
    });
  });

  // Export
  router.post('/export', validateBody(schemas.exportJob), async (req, res, next) => {
    try {
      const { userId, email, format } = req.body;
      const jobId = await exportService.createJob(userId, email, format);
      res.status(202).json({ jobId, message: 'Export job created' });
    } catch (error) {
      logger.error('Export job creation failed', { error: String(error) });
      next(new AppError('EXPORT_FAILED', 'Failed to create export job', 500));
    }
  });

  router.get('/export/:jobId', (req, res, next) => {
    const job = exportService.getJob(req.params.jobId);
    if (!job) return next(new AppError('NOT_FOUND', 'Job not found', 404));
    res.json(job);
  });

  router.get('/export/:jobId/download', (req, res, next) => {
    const job = exportService.getJob(req.params.jobId);
    if (!job) return next(new AppError('NOT_FOUND', 'Job not found', 404));
    if (job.status !== 'completed')
      return next(new AppError('JOB_NOT_COMPLETE', 'Job is not completed yet', 400));
    res.json({ url: job.fileUrl });
  });

  // Backup
  router.post('/backup', validateBody(schemas.backupTrigger), async (req, res, next) => {
    try {
      const job = await backupScheduler.triggerManual(req.body.type);
      res.status(202).json(job);
    } catch (error) {
      logger.error('Backup trigger failed', { error: String(error) });
      next(new AppError('BACKUP_FAILED', 'Failed to trigger backup', 500));
    }
  });

  router.get('/backup', (req, res) => {
    const pageParams = parseOffsetParams(req.query, { limit: 20 });
    const allJobs = backupService.listJobs();
    const jobs = paginateArray(allJobs, pageParams);
    res.json(paginate(jobs, allJobs.length, pageParams));
  });

  router.get('/backup/alerts', (req, res) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    const pageParams = parseOffsetParams(req.query, { limit: 20 });
    const allAlerts = backupMonitor.getAlerts(unacknowledgedOnly);
    const alerts = paginateArray(allAlerts, pageParams);
    res.json(paginate(alerts, allAlerts.length, pageParams));
  });

  router.post('/backup/alerts/:alertId/acknowledge', (req, res, next) => {
    const ok = backupMonitor.acknowledge(req.params.alertId);
    if (!ok) return next(new AppError('NOT_FOUND', 'Alert not found', 404));
    res.json({ acknowledged: true });
  });

  router.get('/backup/:jobId', (req, res, next) => {
    const job = backupService.getJob(req.params.jobId);
    if (!job) return next(new AppError('NOT_FOUND', 'Backup job not found', 404));
    res.json(job);
  });

  router.post('/backup/restore', async (req, res, next) => {
    try {
      const result = req.body.jobId
        ? await recoveryService.restore(req.body.jobId)
        : await recoveryService.restoreLatest();
      res.json(result);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Backup restore failed', { error: message });
      next(new AppError('RESTORE_FAILED', message, 400));
    }
  });

  router.get('/backup/drills', (req, res) => {
    const pageParams = parseOffsetParams(req.query, { limit: 20 });
    const allRuns = backupRestoreDrill.listRuns();
    const runs = paginateArray(allRuns, pageParams);
    res.json(paginate(runs, allRuns.length, pageParams));
  });

  router.get('/backup/drills/alerts', (req, res) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    const pageParams = parseOffsetParams(req.query, { limit: 20 });
    const allAlerts = backupRestoreDrill.listAlerts(unacknowledgedOnly);
    const alerts = paginateArray(allAlerts, pageParams);
    res.json(paginate(alerts, allAlerts.length, pageParams));
  });

  router.post('/backup/drills/alerts/:alertId/acknowledge', (req, res, next) => {
    const ok = backupRestoreDrill.acknowledge(req.params.alertId);
    if (!ok) return next(new AppError('NOT_FOUND', 'Alert not found', 404));
    res.json({ acknowledged: true });
  });

  router.post('/backup/drills/run', async (_req, res, next) => {
    try {
      const run = await backupRestoreDrill.runDrill();
      res.status(202).json(run);
    } catch (error) {
      logger.error('Backup drill failed', { error: String(error) });
      next(new AppError('DRILL_FAILED', 'Failed to run restore drill', 500));
    }
  });

  // Contract Event Indexer Endpoints
  router.get('/events', async (req, res, next) => {
    try {
      const { contractId, eventType, startLedger, endLedger, startTime, endTime } = req.query;
      const pageParams = parseOffsetParams(req.query);
      const options: any = {};
      if (contractId) options.contractId = contractId as string;
      if (eventType) options.eventType = eventType as string;
      if (startLedger) options.startLedger = parseInt(startLedger as string);
      if (endLedger) options.endLedger = parseInt(endLedger as string);
      if (startTime) options.startTime = new Date(startTime as string);
      if (endTime) options.endTime = new Date(endTime as string);
      options.limit = pageParams.limit;
      options.offset = pageParams.offset;

      const result = await eventIndexer.getEvents(options);
      const items: any[] = Array.isArray(result) ? result : (result as any).events ?? [];
      const total: number = Array.isArray(result)
        ? items.length
        : (result as any).total ?? items.length;
      res.json(paginate(items.map(toContractEventDTO), total, pageParams));
    } catch (error) {
      logger.error('Error fetching events', { error: String(error) });
      next(new AppError('EVENTS_FETCH_FAILED', 'Failed to fetch events', 500));
    }
  });

  router.get('/events/stats', async (req, res, next) => {
    try {
      const { contractId } = req.query;
      const totalEvents = await (eventIndexer as any).prisma.contractEvent.count({
        where: contractId ? { contractId: contractId as string } : {},
      });
      const eventTypes = await (eventIndexer as any).prisma.contractEvent.groupBy({
        by: ['eventType'],
        where: contractId ? { contractId: contractId as string } : {},
        _count: { eventType: true },
      });
      res.json({
        totalEvents,
        eventTypeBreakdown: eventTypes.map((type: any) => ({
          type: type.eventType,
          count: type._count.eventType,
        })),
      });
    } catch (error) {
      logger.error('Error fetching event stats', { error: String(error) });
      next(new AppError('EVENT_STATS_FAILED', 'Failed to fetch event stats', 500));
    }
  });

  // ── Analytics Endpoints (Issue #558) ────────────────────────────

  router.get(
    '/analytics/platform',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res, next) => {
      try {
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const stats = await analyticsService.getPlatformStats(targetDate);
        if (!stats) return next(new AppError('NOT_FOUND', 'No analytics data available for this date', 404));
        res.json(stats);
      } catch (error) {
        logger.error('Error fetching platform stats', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch platform statistics', 500));
      }
    }
  );

  router.get(
    '/analytics/platform/trends',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate)
          return next(new AppError('VALIDATION_ERROR', 'startDate and endDate are required', 400));
        const pageParams = parseOffsetParams(req.query, { limit: 30 });
        const trends = await analyticsService.getPlatformTrends(
          new Date(startDate as string),
          new Date(endDate as string),
          pageParams
        );
        res.json({ startDate, endDate, ...paginate(trends, trends.length, pageParams) });
      } catch (error) {
        logger.error('Error fetching platform trends', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch platform trends', 500));
      }
    }
  );

  router.get(
    '/analytics/users/:userId',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res, next) => {
      try {
        const { userId } = req.params;
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const stats = await analyticsService.getUserStats(userId, targetDate);
        if (!stats) return next(new AppError('NOT_FOUND', 'No analytics data available for this user', 404));
        res.json(stats);
      } catch (error) {
        logger.error('Error fetching user stats', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch user statistics', 500));
      }
    }
  );

  router.get(
    '/analytics/groups/:groupId',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res, next) => {
      try {
        const { groupId } = req.params;
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const stats = await analyticsService.getGroupStats(groupId, targetDate);
        if (!stats) return next(new AppError('NOT_FOUND', 'No analytics data available for this group', 404));
        res.json(stats);
      } catch (error) {
        logger.error('Error fetching group stats', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch group statistics', 500));
      }
    }
  );

  router.get(
    '/analytics/events',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res, next) => {
      try {
        const { startDate, endDate } = req.query;
        const pageParams = parseOffsetParams(req.query, { limit: 20 });
        const eventStats = await analyticsService.getEventStats({
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          ...pageParams,
        });
        res.json(paginate(eventStats, eventStats.length, pageParams));
      } catch (error) {
        logger.error('Error fetching event stats', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch event statistics', 500));
      }
    }
  );

  // Record an analytics event
  router.post(
    '/analytics/events',
    analyticsMiddleware.writeRateLimit,
    validateBody(schemas.analyticsEventBody),
    async (req, res, next) => {
      try {
        const { eventType, eventName, userId, groupId, eventData, sessionId } = req.body;
        await analyticsService.recordEvent(eventType, eventName, userId, groupId, eventData, sessionId);
        res.status(201).json({ message: 'Event recorded successfully' });
      } catch (error) {
        logger.error('Error recording event', { error: String(error) });
        next(new AppError('ANALYTICS_RECORD_FAILED', 'Failed to record event', 500));
      }
    }
  );

  // Generate an analytics report
  router.post(
    '/analytics/reports',
    analyticsMiddleware.writeRateLimit,
    validateBody(schemas.analyticsReport),
    async (req, res, next) => {
      try {
        const { reportType, reportName, startDate, endDate, generatedBy } = req.body;
        const report = await analyticsService.generateReport(
          reportType, reportName, new Date(startDate), new Date(endDate), generatedBy
        );
        res.status(201).json(report);
      } catch (error) {
        logger.error('Error generating report', { error: String(error) });
        next(new AppError('REPORT_GENERATION_FAILED', 'Failed to generate report', 500));
      }
    }
  );

  // Get analytics reports
  router.get(
    '/analytics/reports',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res, next) => {
      try {
        const { reportType } = req.query;
        const pageParams = parseOffsetParams(req.query, { limit: 20 });
        const reports = await analyticsService.getReports(reportType as string, pageParams);
        res.json(paginate(reports, reports.length, pageParams));
      } catch (error) {
        logger.error('Error fetching reports', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch reports', 500));
      }
    }
  );

  // Get cache statistics
  router.get('/analytics/cache/stats', analyticsMiddleware.readRateLimit, async (req, res, next) => {
    try {
      const stats = await analyticsService.getCacheStats();
      res.json(stats);
    } catch (error) {
      logger.error('Error fetching cache stats', { error: String(error) });
      next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch cache statistics', 500));
    }
  });

  // Clear analytics cache
  router.post('/analytics/cache/clear', analyticsMiddleware.writeRateLimit, async (req, res, next) => {
    try {
      const cachePattern = req.body.pattern || '*';
      await analyticsService.clearCache(cachePattern);
      res.json({ message: 'Cache cleared successfully' });
    } catch (error) {
      logger.error('Error clearing cache', { error: String(error) });
      next(new AppError('CACHE_CLEAR_FAILED', 'Failed to clear cache', 500));
    }
  });

  // Members export (CSV streaming) for tax/accounting
  // GET /api/members/:address/export.csv
  router.get('/members/:address/export.csv', async (req, res) => {
    const { address } = req.params;

    // Delay loading mock data to keep startup fast
    const { mockTransactions, mockGroups } = await import('../mock_data');

    const transactions = mockTransactions
      .filter((t) => t.memberAddress === address)
      .sort((a, b) => a.timestamp - b.timestamp);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(address)}-contributions-payouts.csv"`
    );

    // Stream rows without buffering full dataset in memory.
    const csvStream = fastCsvFormat({
      headers: ['date', 'group_id', 'type', 'amount', 'transaction_hash'],
    });

    csvStream.on('error', (err: any) => {
      logger.error('CSV stream error', { error: String(err) });
      if (!res.headersSent) res.status(500).end();
    });

    csvStream.pipe(res);

    for (const t of transactions) {
      csvStream.write({
        date: new Date(t.timestamp).toISOString(),
        group_id: t.groupId,
        type: t.type,
        amount: t.amount,
        transaction_hash: t.stellarTxHash,
      });
    }

    csvStream.end();
  });

  // ── Admin Dashboard Endpoints ────────────────────────────────────────────
  const adminService = new AdminService();

  router.get('/admin/stats', adminAuthMiddleware, async (_req, res, next) => {
    try {
      const stats = adminService.getPlatformStats();
      res.json(stats);
    } catch (error) {
      logger.error('Failed to fetch platform stats', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch platform stats', 500));
    }
  });

  router.get('/admin/users', adminAuthMiddleware, async (req, res, next) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const allUsers = adminService.getUsers();
      const users = paginateArray(allUsers, pageParams);
      res.json(paginate({ users }, allUsers.length, pageParams));
    } catch (error) {
      logger.error('Failed to fetch users', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch users', 500));
    }
  });

  router.patch('/admin/users/:id', adminAuthMiddleware, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { updates, adminId } = req.body;
      if (!updates) return next(new AppError('VALIDATION_ERROR', 'updates is required', 400));
      if (!adminId) return next(new AppError('VALIDATION_ERROR', 'adminId is required', 400));
      const updated = adminService.updateUser(id, updates, adminId);
      if (!updated) return next(new AppError('NOT_FOUND', 'User not found', 404));
      res.json(updated);
    } catch (error) {
      logger.error('Failed to update user', { error: String(error) });
      next(new AppError('ADMIN_UPDATE_FAILED', 'Failed to update user', 500));
    }
  });

  router.delete('/admin/users/:id', adminAuthMiddleware, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { adminId } = req.body;
      if (!adminId) return next(new AppError('VALIDATION_ERROR', 'adminId is required', 400));
      const deleted = adminService.deleteUser(id, adminId);
      if (!deleted) return next(new AppError('NOT_FOUND', 'User not found', 404));
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      logger.error('Failed to delete user', { error: String(error) });
      next(new AppError('ADMIN_DELETE_FAILED', 'Failed to delete user', 500));
    }
  });

  router.get('/admin/groups', adminAuthMiddleware, async (req, res, next) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const { mockGroups } = await import('../mock_data');
      const groups = paginateArray(mockGroups, pageParams);
      res.json(paginate({ groups }, mockGroups.length, pageParams));
    } catch (error) {
      logger.error('Failed to fetch groups', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch groups', 500));
    }
  });

  router.post('/admin/groups/:id/flag', adminAuthMiddleware, async (req: any, res, next) => {
    try {
      const { id } = req.params;
      const { flagged, adminId } = req.body;
      if (typeof flagged !== 'boolean') return next(new AppError('VALIDATION_ERROR', 'flagged must be boolean', 400));
      if (!adminId) return next(new AppError('VALIDATION_ERROR', 'adminId is required', 400));
      const { mockGroups } = await import('../mock_data');
      const group = mockGroups.find((g: any) => g.id === id);
      if (!group) return next(new AppError('NOT_FOUND', 'Group not found', 404));
      adminService.logAction(adminId, 'FLAG_GROUP', id, 'Group', { flagged });
      res.json({ ...group, flagged });
    } catch (error) {
      logger.error('Failed to flag group', { error: String(error) });
      next(new AppError('ADMIN_UPDATE_FAILED', 'Failed to flag group', 500));
    }
  });

  router.get('/admin/audit-logs', adminAuthMiddleware, async (req, res, next) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const allLogs = adminService.getAuditLogs();
      const logs = paginateArray(allLogs, pageParams);
      res.json(paginate({ logs }, allLogs.length, pageParams));
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch audit logs', 500));
    }
  });

  // ── API Key Management (Issue #1030) ──────────────────────────────────────

  router.post('/api-keys', async (req: any, res: any, next: NextFunction) => {
    try {
      const { userId } = req.body;
      if (!userId) return next(new AppError('VALIDATION_ERROR', 'userId is required', 400));
      const { key, info } = await apiKeyService.generateKey(userId, req.body.name || 'API Key', req.body.tier || 'free');
      res.status(201).json({ key, info: { ...info, keyPrefix: info.keyPrefix } });
    } catch (error) {
      logger.error('Failed to generate API key', { error: String(error) });
      next(new AppError('API_KEY_CREATION_FAILED', 'Failed to generate API key', 500));
    }
  });

  router.get('/api-keys', apiKeyAuthMiddleware, async (req: any, res: any, next: NextFunction) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const allKeys = await apiKeyService.getKeysForUser(req.apiKey.userId);
      const keys = paginateArray(allKeys, pageParams);
      res.json(paginate({ keys }, allKeys.length, pageParams));
    } catch (error) {
      logger.error('Failed to fetch API keys', { error: String(error) });
      next(new AppError('API_KEY_FETCH_FAILED', 'Failed to fetch API keys', 500));
    }
  });

  router.delete('/api-keys/:keyId', apiKeyAuthMiddleware, async (req: any, res: any, next: NextFunction) => {
    try {
      await apiKeyService.revokeKey(req.params.keyId);
      res.json({ message: 'API key revoked' });
    } catch (error) {
      logger.error('Failed to revoke API key', { error: String(error) });
      next(new AppError('API_KEY_REVOKE_FAILED', 'Failed to revoke API key', 500));
    }
  });

  router.get('/api-keys/:keyId/usage', apiKeyAuthMiddleware, async (req: any, res: any, next: NextFunction) => {
    try {
      const stats = await apiKeyService.getUsageStats(req.params.keyId, parseInt(req.query.hours as string) || 24);
      res.json(stats);
    } catch (error) {
      logger.error('Failed to fetch usage stats', { error: String(error) });
      next(new AppError('API_KEY_STATS_FAILED', 'Failed to fetch usage stats', 500));
    }
  });

  // ── Public API Endpoints (Issue #1030) ────────────────────────────────────

  router.get('/public/groups', apiKeyAuthMiddleware, async (req: any, res: any, next: NextFunction) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;
      const groups = await (eventIndexer as any).prisma.contractEvent.findMany({
        where: { eventType: 'GroupCreated' },
        orderBy: { timestamp: 'desc' },
        take: limit,
        skip: offset,
      });
      await recordApiUsage(req, res);
      res.json({ count: groups.length, limit, offset, groups: groups.map(toContractEventDTO) });
    } catch (error) {
      logger.error('Failed to fetch public groups', { error: String(error) });
      next(new AppError('FETCH_FAILED', 'Failed to fetch groups', 500));
    }
  });

  router.get('/public/stats', apiKeyAuthMiddleware, async (req: any, res: any, next: NextFunction) => {
    try {
      const stats = await analyticsService.getGroupsOverviewStats();
      await recordApiUsage(req, res);
      res.json(stats);
    } catch (error) {
      logger.error('Failed to fetch public stats', { error: String(error) });
      next(new AppError('FETCH_FAILED', 'Failed to fetch statistics', 500));
    }
  });

  return router;
}
