import { Router } from 'express';
import { RecommendationEngine } from './recommendation';
import { ABTestingFramework } from './ab_testing';
import { EmailService } from './email_service';
import { ExportService } from './export_service';
import { BackupService, S3HttpClient } from './backup_service';
import { BackupScheduler } from './backup_scheduler';
import { RecoveryService } from './recovery_service';
import { BackupMonitor } from './backup_monitor';
import { Group, UserInteraction, UserPreference } from './models';

// ── Shared service instances (passed in from app) ────────────────────────────
export interface V1Services {
  engine: RecommendationEngine;
  abTest: ABTestingFramework;
  exportService: ExportService;
  backupService: BackupService;
  backupScheduler: BackupScheduler;
  recoveryService: RecoveryService;
  backupMonitor: BackupMonitor;
}

export function createV1Router(services: V1Services): Router {
  const router = Router();
  const { engine, abTest, exportService, backupService, backupScheduler, recoveryService, backupMonitor } = services;

  // Search
  router.get('/search', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
    try {
      const { SearchService } = await import('./search');
      const searchService = new SearchService(
        (engine as any).groups ?? [],
        (engine as any).interactions ?? [],
        []
      );
      res.json(await searchService.globalSearch(q as string));
    } catch {
      res.status(500).json({ error: 'Search failed' });
    }
  });

  router.get('/search/autocomplete', async (req, res) => {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Query parameter q is required' });
    try {
      const { SearchService } = await import('./search');
      const searchService = new SearchService(
        (engine as any).groups ?? [],
        (engine as any).interactions ?? [],
        []
      );
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

  return router;
}
