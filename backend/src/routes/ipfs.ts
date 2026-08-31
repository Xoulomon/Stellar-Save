import { Router, Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { AppError } from '../lib/errors';
import { IpfsClient, PinningService, PinningQueue, GroupMetadataCache, IpfsMonitor } from '../ipfs';

export function createIpfsRouter(
  ipfs: IpfsClient,
  pinning: PinningService,
  metadataCache: GroupMetadataCache,
  monitor: IpfsMonitor,
): Router {
  const router = Router();

  router.get('/health', async (_req: Request, res: Response) => {
    const healthy = await ipfs.healthCheck();
    const stats = await PinningQueue.getQueueStats();
    res.json({
      healthy,
      nodeUrl: config.ipfs.apiUrl,
      stats,
    });
  });

  router.get('/node', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const nodeId = await ipfs.id();
      res.json(nodeId);
    } catch (err) {
      next(new AppError('IPFS_NODE_UNREACHABLE', 'IPFS node unreachable', 503, String(err)));
    }
  });

  router.get('/pins', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.query;
      if (groupId) {
        const jobs = await PinningQueue.getJobsByGroup(groupId as string);
        return res.json({ jobs });
      }
      const stats = await PinningQueue.getQueueStats();
      res.json({ stats });
    } catch (err) {
      next(new AppError('PIN_STATUS_FETCH_FAILED', 'Failed to fetch pin status', 500, String(err)));
    }
  });

  router.get('/pins/:cid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cid } = req.params;
      const [pinned, accessCount] = await Promise.all([
        pinning.isPinned(cid),
        pinning.getAccessCount(cid),
      ]);
      res.json({ cid, pinned, accessCount });
    } catch (err) {
      next(new AppError('PIN_STATUS_FETCH_FAILED', 'Failed to fetch pin status', 500, String(err)));
    }
  });

  router.post('/pins', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cid, groupId, contractId, priority } = req.body;
      if (!cid || !groupId || !contractId) {
        return next(new AppError('MISSING_FIELDS', 'cid, groupId, and contractId are required', 400));
      }
      const job = await pinning.pinContent(cid, groupId, contractId, priority ?? 0);
      res.status(201).json(job);
    } catch (err) {
      next(new AppError('PIN_CONTENT_FAILED', 'Failed to pin content', 500, String(err)));
    }
  });

  router.delete('/pins/:cid', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cid } = req.params;
      const { groupId, contractId } = req.body;
      if (!groupId || !contractId) {
        return next(new AppError('MISSING_FIELDS', 'groupId and contractId are required', 400));
      }
      const job = await pinning.unpinContent(cid, groupId, contractId);
      res.json(job);
    } catch (err) {
      next(new AppError('UNPIN_CONTENT_FAILED', 'Failed to unpin content', 500, String(err)));
    }
  });

  router.post('/pins/:cid/retry', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { cid } = req.params;
      const job = await PinningQueue.retryFailed(cid);
      if (!job) return next(new AppError('FAILED_JOB_NOT_FOUND', 'No failed job found for this CID', 404));
      res.json(job);
    } catch (err) {
      next(new AppError('RETRY_PIN_FAILED', 'Failed to retry pin', 500, String(err)));
    }
  });

  router.post('/verify', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await pinning.verifyAllPins();
      res.json(result);
    } catch (err) {
      next(new AppError('VERIFICATION_FAILED', 'Verification failed', 500, String(err)));
    }
  });

  router.get('/jobs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { jobId } = req.query;
      if (jobId) {
        const job = await PinningQueue.getJob(jobId as string);
        if (!job) return next(new AppError('JOB_NOT_FOUND', 'Job not found', 404));
        return res.json(job);
      }
      const stats = await PinningQueue.getQueueStats();
      res.json({ stats });
    } catch (err) {
      next(new AppError('JOBS_FETCH_FAILED', 'Failed to fetch jobs', 500, String(err)));
    }
  });

  router.get('/groups/:groupId/metadata', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { groupId } = req.params;
      const { contractId } = req.query;
      if (!contractId) return next(new AppError('MISSING_CONTRACT_ID', 'contractId query parameter is required', 400));
      const status = await metadataCache.getPinStatus(groupId, contractId as string);
      res.json(status);
    } catch (err) {
      next(new AppError('METADATA_PIN_STATUS_FETCH_FAILED', 'Failed to fetch metadata pin status', 500, String(err)));
    }
  });

  router.get('/alerts', async (req: Request, res: Response) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    res.json(monitor.getAlerts(unacknowledgedOnly));
  });

  router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response, next: NextFunction) => {
    const ok = monitor.acknowledge(req.params.alertId);
    if (!ok) return next(new AppError('ALERT_NOT_FOUND', 'Alert not found', 404));
    res.json({ acknowledged: true });
  });

  return router;
}
