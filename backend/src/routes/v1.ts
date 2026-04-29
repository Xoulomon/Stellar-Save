import { Router } from 'express';
import { RecommendationEngine } from '../recommendation';
import { ABTestingFramework } from '../ab_testing';
import { EmailService } from '../email_service';
import { ExportService } from '../export_service';
import { BackupService, S3HttpClient } from '../backup_service';
import { BackupScheduler } from '../backup_scheduler';
import { RecoveryService } from '../recovery_service';
import { BackupMonitor } from '../backup_monitor';
import { ContractEventIndexer } from '../contract_event_indexer';
import { AnalyticsService } from '../analytics_service';
import { createAnalyticsMiddlewareStack } from '../analytics_middleware';
import { Group, UserInteraction, UserPreference } from '../models';

// ── Shared service instances (passed in from app) ────────────────────────────
export interface V1Services {
  engine: RecommendationEngine;
  abTest: ABTestingFramework;
  exportService: ExportService;
  backupService: BackupService;
  backupScheduler: BackupScheduler;
  recoveryService: RecoveryService;
  backupMonitor: BackupMonitor;
  eventIndexer: ContractEventIndexer;
  analyticsService: AnalyticsService;
}

export function createV1Router(services: V1Services): Router {
  const router = Router();
  const { engine, abTest, exportService, backupService, backupScheduler, recoveryService, backupMonitor, eventIndexer, analyticsService } = services;

  // Setup analytics middleware
  const analyticsMiddleware = createAnalyticsMiddlewareStack();

  // Search
  router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
    try {
      const { SearchService } = await import('../search');
      const searchService = new SearchService();
      res.json(await searchService.globalSearch(q as string));
    } catch {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  router.get('/search/autocomplete', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
    try {
      const { SearchService } = await import('../search');
      const searchService = new SearchService();
      res.json(await searchService.autocomplete(q as string));
    } catch {
      res.status(500).json({ error: 'Autocomplete failed' });
    }
  });

  // Preferences
  router.post('/preferences', (req, res) => {
    const pref: UserPreference = req.body;
    if (!pref.userId) return res.status(400).json({ error: 'userId is required' });
    engine.setPreference(pref);
    res.status(200).json({ message: 'Preferences updated' });
  });

  // Recommendations
  router.get('/recommendations/:userId', (req, res) => {
    const { userId } = req.params;
    const bucket = abTest.getBucket(userId);
    const algorithm = bucket === 'A' ? 'content' : 'collaborative';
    const recommendations = engine.getRecommendations(userId, algorithm);
    res.json({ userId, bucket, algorithm, recommendations });
  });

  // Health
  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: 'v1' });
  });

  // Export
  router.post('/export', async (req, res) => {
    const { userId, email, format } = req.body;
    if (!userId || !email || !format)
      return res.status(400).json({ error: 'userId, email, and format are required' });
    if (format !== 'CSV' && format !== 'JSON')
      return res.status(400).json({ error: 'Invalid format. Use CSV or JSON' });
    const jobId = await exportService.createJob(userId, email, format);
    res.status(202).json({ jobId, message: 'Export job created' });
  });

  router.get('/export/:jobId', (req, res) => {
    const job = exportService.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  });

  router.get('/export/:jobId/download', (req, res) => {
    const job = exportService.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    if (job.status !== 'completed') return res.status(400).json({ error: 'Job is not completed yet' });
    res.json({ url: job.fileUrl });
  });

  // Backup
  router.post('/backup', async (req, res) => {
    const { type } = req.body;
    if (type !== 'full' && type !== 'incremental')
      return res.status(400).json({ error: 'type must be "full" or "incremental"' });
    const job = await backupScheduler.triggerManual(type);
    res.status(202).json(job);
  });

  router.get('/backup', (_req, res) => res.json(backupService.listJobs()));

  router.get('/backup/alerts', (req, res) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    res.json(backupMonitor.getAlerts(unacknowledgedOnly));
  });

  router.post('/backup/alerts/:alertId/acknowledge', (req, res) => {
    const ok = backupMonitor.acknowledge(req.params.alertId);
    if (!ok) return res.status(404).json({ error: 'Alert not found' });
    res.json({ acknowledged: true });
  });

  router.get('/backup/:jobId', (req, res) => {
    const job = backupService.getJob(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Backup job not found' });
    res.json(job);
  });

  router.post('/backup/restore', async (req, res) => {
    try {
      const result = req.body.jobId
        ? await recoveryService.restore(req.body.jobId)
        : await recoveryService.restoreLatest();
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // Contract Event Indexer Endpoints
  router.get('/events', async (req, res) => {
    try {
      const {
        contractId,
        eventType,
        startLedger,
        endLedger,
        startTime,
        endTime,
        limit,
        offset
      } = req.query;

      const options: any = {};
      if (contractId) options.contractId = contractId as string;
      if (eventType) options.eventType = eventType as string;
      if (startLedger) options.startLedger = parseInt(startLedger as string);
      if (endLedger) options.endLedger = parseInt(endLedger as string);
      if (startTime) options.startTime = new Date(startTime as string);
      if (endTime) options.endTime = new Date(endTime as string);
      if (limit) options.limit = parseInt(limit as string);
      if (offset) options.offset = parseInt(offset as string);

      const result = await eventIndexer.getEvents(options);
      res.json(result);
    } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ error: 'Failed to fetch events' });
    }
  });

  router.get('/events/stats', async (req, res) => {
    try {
      const { contractId } = req.query;
      // Get basic stats about events
      const totalEvents = await (eventIndexer as any).prisma.contractEvent.count({
        where: contractId ? { contractId: contractId as string } : {}
      });

      const eventTypes = await (eventIndexer as any).prisma.contractEvent.groupBy({
        by: ['eventType'],
        where: contractId ? { contractId: contractId as string } : {},
        _count: { eventType: true }
      });

      res.json({
        totalEvents,
        eventTypeBreakdown: eventTypes.map((type: any) => ({
          type: type.eventType,
          count: type._count.eventType
        }))
      });
    } catch (error) {
      console.error('Error fetching event stats:', error);
      res.status(500).json({ error: 'Failed to fetch event stats' });
    }
  });

  // ── Analytics Endpoints (Issue #558) ────────────────────────────
  
  // Get platform statistics for a specific date
  router.get(
    '/analytics/platform',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res) => {
      try {
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();
        const stats = await analyticsService.getPlatformStats(targetDate);
        
        if (!stats) {
          return res.status(404).json({ error: 'No analytics data available for this date' });
        }
        
        res.json(stats);
      } catch (error) {
        console.error('Error fetching platform stats:', error);
        res.status(500).json({ error: 'Failed to fetch platform statistics' });
      }
    }
  );

  // Get platform trends over a date range
  router.get(
    '/analytics/platform/trends',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res) => {
      try {
        const { startDate, endDate, limit, offset } = req.query;
        
        if (!startDate || !endDate) {
          return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const trends = await analyticsService.getPlatformTrends(
          new Date(startDate as string),
          new Date(endDate as string),
          {
            limit: limit ? parseInt(limit as string) : 30,
            offset: offset ? parseInt(offset as string) : 0,
          }
        );

        res.json({
          startDate,
          endDate,
          dataPoints: trends.length,
          trends,
        });
      } catch (error) {
        console.error('Error fetching platform trends:', error);
        res.status(500).json({ error: 'Failed to fetch platform trends' });
      }
    }
  );

  // Get user-specific analytics
  router.get(
    '/analytics/users/:userId',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();

        const stats = await analyticsService.getUserStats(userId, targetDate);

        if (!stats) {
          return res.status(404).json({ error: 'No analytics data available for this user' });
        }

        res.json(stats);
      } catch (error) {
        console.error('Error fetching user stats:', error);
        res.status(500).json({ error: 'Failed to fetch user statistics' });
      }
    }
  );

  // Get group-specific analytics
  router.get(
    '/analytics/groups/:groupId',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res) => {
      try {
        const { groupId } = req.params;
        const { date } = req.query;
        const targetDate = date ? new Date(date as string) : new Date();

        const stats = await analyticsService.getGroupStats(groupId, targetDate);

        if (!stats) {
          return res.status(404).json({ error: 'No analytics data available for this group' });
        }

        res.json(stats);
      } catch (error) {
        console.error('Error fetching group stats:', error);
        res.status(500).json({ error: 'Failed to fetch group statistics' });
      }
    }
  );

  // Get analytics events statistics
  router.get(
    '/analytics/events',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res) => {
      try {
        const { startDate, endDate, limit, offset } = req.query;

        const eventStats = await analyticsService.getEventStats({
          startDate: startDate ? new Date(startDate as string) : undefined,
          endDate: endDate ? new Date(endDate as string) : undefined,
          limit: limit ? parseInt(limit as string) : 20,
          offset: offset ? parseInt(offset as string) : 0,
        });

        res.json({
          count: eventStats.length,
          events: eventStats,
        });
      } catch (error) {
        console.error('Error fetching event stats:', error);
        res.status(500).json({ error: 'Failed to fetch event statistics' });
      }
    }
  );

  // Record an analytics event
  router.post(
    '/analytics/events',
    analyticsMiddleware.writeRateLimit,
    async (req, res) => {
      try {
        const { eventType, eventName, userId, groupId, eventData, sessionId } = req.body;

        if (!eventType || !eventName) {
          return res.status(400).json({
            error: 'eventType and eventName are required',
          });
        }

        await analyticsService.recordEvent(
          eventType,
          eventName,
          userId,
          groupId,
          eventData,
          sessionId
        );

        res.status(201).json({ message: 'Event recorded successfully' });
      } catch (error) {
        console.error('Error recording event:', error);
        res.status(500).json({ error: 'Failed to record event' });
      }
    }
  );

  // Generate an analytics report
  router.post(
    '/analytics/reports',
    analyticsMiddleware.writeRateLimit,
    async (req, res) => {
      try {
        const { reportType, reportName, startDate, endDate, generatedBy } = req.body;

        if (!reportType || !reportName || !startDate || !endDate) {
          return res.status(400).json({
            error: 'reportType, reportName, startDate, and endDate are required',
          });
        }

        const report = await analyticsService.generateReport(
          reportType,
          reportName,
          new Date(startDate),
          new Date(endDate),
          generatedBy
        );

        res.status(201).json(report);
      } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ error: 'Failed to generate report' });
      }
    }
  );

  // Get analytics reports
  router.get(
    '/analytics/reports',
    analyticsMiddleware.readRateLimit,
    analyticsMiddleware.cache,
    async (req, res) => {
      try {
        const { reportType, limit, offset } = req.query;

        const reports = await analyticsService.getReports(reportType as string, {
          limit: limit ? parseInt(limit as string) : 20,
          offset: offset ? parseInt(offset as string) : 0,
        });

        res.json({
          count: reports.length,
          reports,
        });
      } catch (error) {
        console.error('Error fetching reports:', error);
        res.status(500).json({ error: 'Failed to fetch reports' });
      }
    }
  );

  // Get cache statistics
  router.get(
    '/analytics/cache/stats',
    analyticsMiddleware.readRateLimit,
    async (req, res) => {
      try {
        const stats = await analyticsService.getCacheStats();
        res.json(stats);
      } catch (error) {
        console.error('Error fetching cache stats:', error);
        res.status(500).json({ error: 'Failed to fetch cache statistics' });
      }
    }
  );

  // Clear analytics cache
  router.post(
    '/analytics/cache/clear',
    analyticsMiddleware.writeRateLimit,
    async (req, res) => {
      try {
        const { pattern } = req.body;
        const cachePattern = pattern || '*';

        await analyticsService.clearCache(cachePattern);
        res.json({ message: 'Cache cleared successfully' });
      } catch (error) {
        console.error('Error clearing cache:', error);
        res.status(500).json({ error: 'Failed to clear cache' });
      }
    }
  );

  return router;
}
