import { Router, Request, Response } from 'express';
import { config } from '../config';
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

  router.get('/node', async (_req: Request, res: Response) => {
    try {
      const nodeId = await ipfs.id();
      res.json(nodeId);
    } catch (err) {
      res.status(503).json({ error: 'IPFS node unreachable', detail: String(err) });
    }
  });

  router.get('/pins', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.query;
      if (groupId) {
        const jobs = await PinningQueue.getJobsByGroup(groupId as string);
        return res.json({ jobs });
      }
      const stats = await PinningQueue.getQueueStats();
      res.json({ stats });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch pin status', detail: String(err) });
    }
  });

  router.get('/pins/:cid', async (req: Request, res: Response) => {
    try {
      const { cid } = req.params;
      const [pinned, accessCount] = await Promise.all([
        pinning.isPinned(cid),
        pinning.getAccessCount(cid),
      ]);
      res.json({ cid, pinned, accessCount });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch pin status', detail: String(err) });
    }
  });

  router.post('/pins', async (req: Request, res: Response) => {
    try {
      const { cid, groupId, contractId, priority } = req.body;
      if (!cid || !groupId || !contractId) {
        return res.status(400).json({ error: 'cid, groupId, and contractId are required' });
      }
      const job = await pinning.pinContent(cid, groupId, contractId, priority ?? 0);
      res.status(201).json(job);
    } catch (err) {
      res.status(500).json({ error: 'Failed to pin content', detail: String(err) });
    }
  });

  router.delete('/pins/:cid', async (req: Request, res: Response) => {
    try {
      const { cid } = req.params;
      const { groupId, contractId } = req.body;
      if (!groupId || !contractId) {
        return res.status(400).json({ error: 'groupId and contractId are required' });
      }
      const job = await pinning.unpinContent(cid, groupId, contractId);
      res.json(job);
    } catch (err) {
      res.status(500).json({ error: 'Failed to unpin content', detail: String(err) });
    }
  });

  router.post('/pins/:cid/retry', async (req: Request, res: Response) => {
    try {
      const { cid } = req.params;
      const job = await PinningQueue.retryFailed(cid);
      if (!job) return res.status(404).json({ error: 'No failed job found for this CID' });
      res.json(job);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retry pin', detail: String(err) });
    }
  });

  router.post('/verify', async (_req: Request, res: Response) => {
    try {
      const result = await pinning.verifyAllPins();
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: 'Verification failed', detail: String(err) });
    }
  });

  router.get('/jobs', async (req: Request, res: Response) => {
    try {
      const { jobId } = req.query;
      if (jobId) {
        const job = await PinningQueue.getJob(jobId as string);
        if (!job) return res.status(404).json({ error: 'Job not found' });
        return res.json(job);
      }
      const stats = await PinningQueue.getQueueStats();
      res.json({ stats });
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch jobs', detail: String(err) });
    }
  });

  router.get('/groups/:groupId/metadata', async (req: Request, res: Response) => {
    try {
      const { groupId } = req.params;
      const { contractId } = req.query;
      if (!contractId) return res.status(400).json({ error: 'contractId query parameter is required' });
      const status = await metadataCache.getPinStatus(groupId, contractId as string);
      res.json(status);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch metadata pin status', detail: String(err) });
    }
  });

  router.get('/alerts', async (req: Request, res: Response) => {
    const unacknowledgedOnly = req.query.unacknowledgedOnly === 'true';
    res.json(monitor.getAlerts(unacknowledgedOnly));
  });

  router.post('/alerts/:alertId/acknowledge', async (req: Request, res: Response) => {
    const ok = monitor.acknowledge(req.params.alertId);
    if (!ok) return res.status(404).json({ error: 'Alert not found' });
    res.json({ acknowledged: true });
  });

  return router;
}
