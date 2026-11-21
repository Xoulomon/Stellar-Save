import { Router } from 'express';
import { format as fastCsvFormat } from 'fast-csv';

import { AdminService } from '../admin_service';
import {
  createAnalyticsMiddlewareStack,
  createAnalyticsCacheMiddleware,
} from '../analytics_middleware';
import { apiKeyAuthMiddleware, recordApiUsage } from '../api_key_rate_limiter';
import { apiKeyService } from '../api_key_service';
import { toContractEventDTO } from '../dto';
import { AppError } from '../lib/errors';
import { parseOffsetParams, paginate, paginateArray } from '../lib/pagination';
import {
  createEnvelope,
  createEnvelopeWithPagination,
  errorEnvelope,
} from '../lib/response-envelope';
import { validateBody, validateQuery, validateParams, schemas } from '../lib/validation';
import { logger } from '../logger';
import { adminAuthMiddleware } from '../modules/auth/auth_middleware';
import { readinessCheckCache } from '../redis';
import { createGovernanceRouter } from './governance';
import { createInsuranceRouter } from './insurance';
import { createNotificationRouter } from './notifications';
import { createSseRouter } from './sse';

import type { AnalyticsService } from '../analytics_service';
import type { BackupMonitor } from '../backup_monitor';
import type { BackupRestoreDrill } from '../backup_restore_drill';
import type { BackupScheduler } from '../backup_scheduler';
import type { BackupService } from '../backup_service';
import type { ContractEventIndexer } from '../contract_event_indexer';
import type { ExportService } from '../export_service';
import type { FeedbackService } from '../feedback_service';
import type { RecommendationEngine } from '../recommendation';
import type { RecoveryService } from '../recovery_service';
import type { Request, Response, NextFunction } from 'express';

interface V1Request extends Request {
  validatedQuery?: Record<string, unknown>;
  validatedBody?: Record<string, unknown>;
  validatedParams?: Record<string, unknown>;
  apiKey?: { keyId: string; userId?: string };
}

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
    validateQuery(schemas.analyticsDateQuery),
    async (req: V1Request, res, next) => {
      try {
        const stats = await analyticsService.getGroupsOverviewStats();
        res.json(createEnvelope(stats));
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
  router.get('/search', validateQuery(schemas.searchQuery), async (req: V1Request, res, next) => {
    const { q } = (req.validatedQuery ?? {}) as { q: string };
    try {
      const { SearchService } = await import('../search');
      const searchService = new SearchService();
      res.json(createEnvelope(await searchService.globalSearch(q)));
    } catch (error) {
      logger.error('Search failed', { error: String(error) });
      next(new AppError('SEARCH_FAILED', 'Search failed', 500));
    }
  });

  router.get(
    '/search/autocomplete',
    validateQuery(schemas.searchQuery),
    async (req: V1Request, res, next) => {
      const { q } = (req.validatedQuery ?? {}) as { q: string };
      try {
        const { SearchService } = await import('../search');
        const searchService = new SearchService();
        res.json(createEnvelope(await searchService.autocomplete(q)));
      } catch (error) {
        logger.error('Autocomplete failed', { error: String(error) });
        next(new AppError('SEARCH_FAILED', 'Autocomplete failed', 500));
      }
    }
  );

  // Preferences
  router.post('/preferences', validateBody(schemas.userPreferenceUpdate), (req, res, _next) => {
    const pref = req.body;
    engine.setPreference(pref);
    res.status(200).json(createEnvelope({ message: 'Preferences updated' }));
  });

  // Recommendations
  router.get('/recommendations/:userId', validateParams(schemas.userIdParam), (req, res) => {
    const { userId } = req.params;
    const recommendations = engine.getRecommendations(userId, 'collaborative');
    res.json(createEnvelope({ userId, algorithm: 'collaborative', recommendations }));
  });

  // Health
  router.get('/health', (req, res) => {
    res.json(
      createEnvelope({
        status: 'ok',
        version: 'v1',
      })
    );
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

    const payload = {
      status: up ? 'ready' : 'not_ready',
      version: 'v1',
      responseTimeMs,
      dependencies: {
        database,
        horizon,
        cache,
      },
    };

    res.status(up ? 200 : 503).json(up ? createEnvelope(payload) : errorEnvelope(payload));
  });

  // Export
  router.post('/export', validateBody(schemas.exportJob), async (req, res, next) => {
    try {
      const { userId, email, format } = req.body;
      const jobId = await exportService.createJob(userId, email, format);
      res.status(202).json(createEnvelope({ jobId, message: 'Export job created' }));
    } catch (error) {
      logger.error('Export job creation failed', { error: String(error) });
      next(new AppError('EXPORT_FAILED', 'Failed to create export job', 500));
    }
  });

  router.get('/export/:jobId', validateParams(schemas.jobIdParam), (req, res, next) => {
    const { jobId } = req.params;
    const job = exportService.getJob(jobId);
    if (!job) return next(new AppError('NOT_FOUND', 'Job not found', 404));
    res.json(createEnvelope(job));
  });

  router.get('/export/:jobId/download', validateParams(schemas.jobIdParam), (req, res, next) => {
    const { jobId } = req.params;
    const job = exportService.getJob(jobId);
    if (!job) return next(new AppError('NOT_FOUND', 'Job not found', 404));
    if (job.status !== 'completed')
      return next(new AppError('JOB_NOT_COMPLETE', 'Job is not completed yet', 400));
    res.json(createEnvelope({ url: job.fileUrl }));
  });

  // Backup
  router.post('/backup', validateBody(schemas.backupTrigger), async (req, res, next) => {
    try {
      const job = await backupScheduler.triggerManual(req.body.type);
      res.status(202).json(createEnvelope(job));
    } catch (error) {
      logger.error('Backup trigger failed', { error: String(error) });
      next(new AppError('BACKUP_FAILED', 'Failed to trigger backup', 500));
    }
  });

  router.get('/backup', (req, res) => {
    const pageParams = parseOffsetParams(req.query, { limit: 20 });
    const allJobs = backupService.listJobs();
    res.json(createEnvelopeWithPagination(paginateArray(allJobs, pageParams)));
  });

  router.get('/backup/alerts', (req, res) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    const pageParams = parseOffsetParams(req.query, { limit: 20 });
    const allAlerts = backupMonitor.getAlerts(unacknowledgedOnly);
    res.json(createEnvelopeWithPagination(paginateArray(allAlerts, pageParams)));
  });

  router.post('/backup/alerts/:alertId/acknowledge', (req, res, next) => {
    const ok = backupMonitor.acknowledge(req.params.alertId);
    if (!ok) return next(new AppError('NOT_FOUND', 'Alert not found', 404));
    res.json(createEnvelope({ acknowledged: true }));
  });

  router.get('/backup/:jobId', validateParams(schemas.jobIdParam), (req, res, next) => {
    const { jobId } = req.params;
    const job = backupService.getJob(jobId);
    if (!job) return next(new AppError('NOT_FOUND', 'Backup job not found', 404));
    res.json(createEnvelope(job));
  });

  router.post('/backup/restore', validateBody(schemas.backupRestore), async (req, res, next) => {
    try {
      const { jobId } = req.body;
      const result = jobId
        ? await recoveryService.restore(jobId)
        : await recoveryService.restoreLatest();
      res.json(createEnvelope(result));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Backup restore failed', { error: message });
      next(new AppError('RESTORE_FAILED', message, 400));
    }
  });

  router.post(
    '/backup/alerts/:alertId/acknowledge',
    validateParams(schemas.alertIdParam),
    (req, res, next) => {
      const { alertId } = req.params;
      const ok = backupMonitor.acknowledge(alertId);
      if (!ok) return next(new AppError('NOT_FOUND', 'Alert not found', 404));
      res.json(createEnvelope({ acknowledged: true }));
    }
  );

  router.post(
    '/backup/drills/alerts/:alertId/acknowledge',
    validateParams(schemas.alertIdParam),
    (req, res, next) => {
      const { alertId } = req.params;
      const ok = backupRestoreDrill.acknowledge(alertId);
      if (!ok) return next(new AppError('NOT_FOUND', 'Alert not found', 404));
      res.json(createEnvelope({ acknowledged: true }));
    }
  );

  router.post('/backup/drills/run', async (_req, res, next) => {
    try {
      const run = await backupRestoreDrill.runDrill();
      res.status(202).json(createEnvelope(run));
    } catch (error) {
      logger.error('Backup drill failed', { error: String(error) });
      next(new AppError('DRILL_FAILED', 'Failed to run restore drill', 500));
    }
  });

  // Contract Event Indexer Endpoints
  router.get(
    '/events',
    validateQuery(schemas.eventsFilterQuery),
    async (req: V1Request, res, next) => {
      try {
        const { contractId, eventType, startLedger, endLedger, startTime, endTime, limit, offset } =
          (req.validatedQuery ?? {}) as {
            contractId?: string;
            eventType?: string;
            startLedger?: number;
            endLedger?: number;
            startTime?: string;
            endTime?: string;
            limit?: number;
            offset?: number;
          };
        const options: Record<string, unknown> = {};
        if (contractId) options.contractId = contractId;
        if (eventType) options.eventType = eventType;
        if (startLedger !== undefined) options.startLedger = startLedger;
        if (endLedger !== undefined) options.endLedger = endLedger;
        if (startTime) options.startTime = new Date(startTime);
        if (endTime) options.endTime = new Date(endTime);
        options.limit = limit;
        options.offset = offset;

        const result = await eventIndexer.getEvents(
          options as Parameters<typeof eventIndexer.getEvents>[0]
        );
        const items: unknown[] = Array.isArray(result)
          ? result
          : ((result as { events?: unknown[] }).events ?? []);
        const total: number = Array.isArray(result)
          ? items.length
          : ((result as { total?: number }).total ?? items.length);
        res.json(
          createEnvelopeWithPagination(
            paginate(
              items.map((item) =>
                toContractEventDTO(item as Parameters<typeof toContractEventDTO>[0])
              ),
              total,
              { limit, offset }
            )
          )
        );
      } catch (error) {
        logger.error('Error fetching events', { error: String(error) });
        next(new AppError('EVENTS_FETCH_FAILED', 'Failed to fetch events', 500));
      }
    }
  );

  router.get('/events/stats', async (req, res, next) => {
    try {
      const { contractId } = req.query;
      interface EventIndexerDb {
        prisma: {
          contractEvent: {
            count: (args: unknown) => Promise<number>;
            groupBy: (
              args: unknown
            ) => Promise<Array<{ eventType: string; _count: { eventType: number } }>>;
          };
        };
      }
      const indexerDb = eventIndexer as unknown as EventIndexerDb;
      const totalEvents = await indexerDb.prisma.contractEvent.count({
        where: contractId ? { contractId: contractId as string } : {},
      });
      const eventTypes = await indexerDb.prisma.contractEvent.groupBy({
        by: ['eventType'],
        where: contractId ? { contractId: contractId as string } : {},
        _count: { eventType: true },
      });
      res.json(
        createEnvelope({
          totalEvents,
          eventTypeBreakdown: eventTypes.map(
            (type: { eventType: string; _count: { eventType: number } }) => ({
              type: type.eventType,
              count: type._count.eventType,
            })
          ),
        })
      );
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
    validateQuery(schemas.analyticsDateQuery),
    async (req: V1Request, res, next) => {
      try {
        const { date } = (req.validatedQuery || {}) as { date?: string };
        const targetDate = date ? new Date(date) : new Date();
        const stats = await analyticsService.getPlatformStats(targetDate);
        if (!stats)
          return next(new AppError('NOT_FOUND', 'No analytics data available for this date', 404));
        res.json(createEnvelope(stats));
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
        res.json(
          createEnvelopeWithPagination({
            startDate,
            endDate,
            ...paginate(trends, trends.length, pageParams),
          })
        );
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
    validateParams(schemas.userIdParam),
    validateQuery(schemas.analyticsDateQuery),
    async (req: V1Request, res, next) => {
      try {
        const { userId } = req.params;
        const { date } = (req.validatedQuery || {}) as { date?: string };
        const targetDate = date ? new Date(date) : new Date();
        const stats = await analyticsService.getUserStats(userId, targetDate);
        if (!stats)
          return next(new AppError('NOT_FOUND', 'No analytics data available for this user', 404));
        res.json(createEnvelope(stats));
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
    validateParams(schemas.groupIdParam),
    validateQuery(schemas.analyticsDateQuery),
    async (req: V1Request, res, next) => {
      try {
        const { groupId } = req.params;
        const { date } = (req.validatedQuery || {}) as { date?: string };
        const targetDate = date ? new Date(date) : new Date();
        const stats = await analyticsService.getGroupStats(groupId, targetDate);
        if (!stats)
          return next(new AppError('NOT_FOUND', 'No analytics data available for this group', 404));
        res.json(createEnvelope(stats));
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
    validateQuery(schemas.paginationWithDateRange),
    async (req: V1Request, res, next) => {
      try {
        const { startDate, endDate, limit, offset } = (req.validatedQuery ?? {}) as {
          startDate?: string;
          endDate?: string;
          limit?: number;
          offset?: number;
        };
        const eventStats = await analyticsService.getEventStats({
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          limit,
          offset,
        });
        res.json(
          createEnvelopeWithPagination(paginate(eventStats, eventStats.length, { limit, offset }))
        );
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
        await analyticsService.recordEvent(
          eventType,
          eventName,
          userId,
          groupId,
          eventData,
          sessionId
        );
        res.status(201).json(createEnvelope({ message: 'Event recorded successfully' }));
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
          reportType,
          reportName,
          new Date(startDate),
          new Date(endDate),
          generatedBy
        );
        res.status(201).json(createEnvelope(report));
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
    validateQuery(schemas.paginationQuery),
    async (req: V1Request, res, next) => {
      try {
        const { reportType } = req.query;
        const { limit, offset } = (req.validatedQuery ?? {}) as { limit?: number; offset?: number };
        const reports = await analyticsService.getReports(reportType as string, {
          limit,
          offset,
        });
        res.json(
          createEnvelopeWithPagination(paginate(reports, reports.length, { limit, offset }))
        );
      } catch (error) {
        logger.error('Error fetching reports', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch reports', 500));
      }
    }
  );

  // Get cache statistics
  router.get(
    '/analytics/cache/stats',
    analyticsMiddleware.readRateLimit,
    async (req, res, next) => {
      try {
        const stats = await analyticsService.getCacheStats();
        res.json(createEnvelope(stats));
      } catch (error) {
        logger.error('Error fetching cache stats', { error: String(error) });
        next(new AppError('ANALYTICS_FETCH_FAILED', 'Failed to fetch cache statistics', 500));
      }
    }
  );

  // Clear analytics cache
  router.post(
    '/analytics/cache/clear',
    analyticsMiddleware.writeRateLimit,
    validateBody(schemas.cachePattern),
    async (req, res, next) => {
      try {
        const { pattern } = req.body;
        await analyticsService.clearCache(pattern);
        res.json(createEnvelope({ message: 'Cache cleared successfully' }));
      } catch (error) {
        logger.error('Error clearing cache', { error: String(error) });
        next(new AppError('CACHE_CLEAR_FAILED', 'Failed to clear cache', 500));
      }
    }
  );

  // Members export (CSV streaming) for tax/accounting
  // GET /api/members/:address/export.csv
  router.get(
    '/members/:address/export.csv',
    validateParams(schemas.addressParam),
    async (req, res) => {
      const { address } = req.params;

      // Delay loading mock data to keep startup fast
      const { mockTransactions } = await import('../mock_data');

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

      csvStream.on('error', (err: unknown) => {
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
    }
  );

  // ── Admin Dashboard Endpoints ────────────────────────────────────────────
  const adminService = new AdminService();

  router.get('/admin/stats', adminAuthMiddleware, async (_req, res, next) => {
    try {
      const stats = adminService.getPlatformStats();
      res.json(createEnvelope(stats));
    } catch (error) {
      logger.error('Failed to fetch platform stats', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch platform stats', 500));
    }
  });

  router.get('/admin/users', adminAuthMiddleware, async (req, res, next) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const allUsers = adminService.getUsers();
      res.json(createEnvelopeWithPagination(paginateArray(allUsers, pageParams)));
    } catch (error) {
      logger.error('Failed to fetch users', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch users', 500));
    }
  });

  router.patch(
    '/admin/users/:id',
    adminAuthMiddleware,
    validateParams(schemas.idParam),
    validateBody(schemas.adminUserUpdate),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { updates, adminId } = req.body;
        const updated = adminService.updateUser(id, updates, adminId);
        if (!updated) return next(new AppError('NOT_FOUND', 'User not found', 404));
        res.json(createEnvelope(updated));
      } catch (error) {
        logger.error('Failed to update user', { error: String(error) });
        next(new AppError('ADMIN_UPDATE_FAILED', 'Failed to update user', 500));
      }
    }
  );

  router.delete(
    '/admin/users/:id',
    adminAuthMiddleware,
    validateParams(schemas.idParam),
    validateBody(schemas.adminUserDelete),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { adminId } = req.body;
        const deleted = adminService.deleteUser(id, adminId);
        if (!deleted) return next(new AppError('NOT_FOUND', 'User not found', 404));
        res.json(createEnvelope({ message: 'User deleted successfully' }));
      } catch (error) {
        logger.error('Failed to delete user', { error: String(error) });
        next(new AppError('ADMIN_DELETE_FAILED', 'Failed to delete user', 500));
      }
    }
  );

  router.get('/admin/groups', adminAuthMiddleware, async (req, res, next) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const { mockGroups } = await import('../mock_data');
      res.json(createEnvelopeWithPagination(paginateArray(mockGroups, pageParams)));
    } catch (error) {
      logger.error('Failed to fetch groups', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch groups', 500));
    }
  });

  router.post(
    '/admin/groups/:id/flag',
    adminAuthMiddleware,
    validateParams(schemas.idParam),
    validateBody(schemas.adminGroupFlag),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { id } = req.params;
        const { flagged, adminId } = req.body;
        const { mockGroups } = await import('../mock_data');
        const group = (mockGroups as Array<{ id: string; [key: string]: unknown }>).find(
          (g) => g.id === id
        );
        if (!group) return next(new AppError('NOT_FOUND', 'Group not found', 404));
        adminService.logAction(adminId, 'FLAG_GROUP', id, 'Group', { flagged });
        res.json(createEnvelope({ ...group, flagged }));
      } catch (error) {
        logger.error('Failed to flag group', { error: String(error) });
        next(new AppError('ADMIN_UPDATE_FAILED', 'Failed to flag group', 500));
      }
    }
  );

  router.get('/admin/audit-logs', adminAuthMiddleware, async (req, res, next) => {
    try {
      const pageParams = parseOffsetParams(req.query, { limit: 20 });
      const allLogs = adminService.getAuditLogs();
      res.json(createEnvelopeWithPagination(paginateArray(allLogs, pageParams)));
    } catch (error) {
      logger.error('Failed to fetch audit logs', { error: String(error) });
      next(new AppError('ADMIN_FETCH_FAILED', 'Failed to fetch audit logs', 500));
    }
  });

  // ── API Key Management (Issue #1030) ──────────────────────────────────────

  router.post(
    '/api-keys',
    validateBody(schemas.apiKeyCreate),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId, name, tier } = req.body;
        const { key, info } = await apiKeyService.generateKey(
          userId,
          name || 'API Key',
          tier || 'free'
        );
        res
          .status(201)
          .json(createEnvelope({ key, info: { ...info, keyPrefix: info.keyPrefix } }));
      } catch (error) {
        logger.error('Failed to generate API key', { error: String(error) });
        next(new AppError('API_KEY_CREATION_FAILED', 'Failed to generate API key', 500));
      }
    }
  );

  router.delete(
    '/api-keys/:keyId',
    apiKeyAuthMiddleware,
    validateParams(schemas.keyIdParam),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await apiKeyService.revokeKey(req.params.keyId);
        res.json(createEnvelope({ message: 'API key revoked' }));
      } catch (error) {
        logger.error('Failed to revoke API key', { error: String(error) });
        next(new AppError('API_KEY_REVOKE_FAILED', 'Failed to revoke API key', 500));
      }
    }
  );

  router.get(
    '/api-keys/:keyId/usage',
    apiKeyAuthMiddleware,
    validateParams(schemas.keyIdParam),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await apiKeyService.getUsageStats(
          req.params.keyId,
          parseInt(req.query.hours as string) || 24
        );
        res.json(createEnvelope(stats));
      } catch (error) {
        logger.error('Failed to fetch usage stats', { error: String(error) });
        next(new AppError('API_KEY_STATS_FAILED', 'Failed to fetch usage stats', 500));
      }
    }
  );

  // ── Public API Endpoints (Issue #1030) ────────────────────────────────────

  router.get(
    '/public/groups',
    apiKeyAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const pageParams = parseOffsetParams(req.query, { limit: 20, maxLimit: 100 });
        interface EventIndexerGroupsDb {
          prisma: {
            contractEvent: {
              findMany: (args: unknown) => Promise<unknown[]>;
            };
          };
        }
        const indexerDb = eventIndexer as unknown as EventIndexerGroupsDb;
        const groups = await indexerDb.prisma.contractEvent.findMany({
          where: { eventType: 'GroupCreated' },
          orderBy: { timestamp: 'desc' },
          take: pageParams.limit,
          skip: pageParams.offset,
        });
        await recordApiUsage(req, res);
        res.json(
          createEnvelopeWithPagination({
            count: groups.length,
            limit,
            offset,
            groups: groups.map((g) =>
              toContractEventDTO(g as Parameters<typeof toContractEventDTO>[0])
            ),
          })
        );
      } catch (error) {
        logger.error('Failed to fetch public groups', { error: String(error) });
        next(new AppError('FETCH_FAILED', 'Failed to fetch groups', 500));
      }
    }
  );

  router.get(
    '/public/stats',
    apiKeyAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const stats = await analyticsService.getGroupsOverviewStats();
        await recordApiUsage(req, res);
        res.json(createEnvelope(stats));
      } catch (error) {
        logger.error('Failed to fetch public stats', { error: String(error) });
        next(new AppError('FETCH_FAILED', 'Failed to fetch statistics', 500));
      }
    }
  );

  return router;
}
