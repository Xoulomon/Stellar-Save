import { Router } from 'express';
import type { StellarEventIndexer, EventQueryOptions } from '../stellar_event_indexer';

export function createIndexerRouter(indexer: StellarEventIndexer) {
  const router = Router();

  router.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      ready: indexer.isReady(),
      lastCursor: indexer.getLastCursor(),
    });
  });

  router.get('/events', async (req, res) => {
    if (!indexer.isReady()) {
      return res.status(503).json({ error: 'Indexer is not ready' });
    }

    const options: EventQueryOptions = {
      contractId: typeof req.query.contractId === 'string' ? req.query.contractId : undefined,
      type: typeof req.query.type === 'string' ? req.query.type : undefined,
      topic: typeof req.query.topic === 'string' ? req.query.topic : undefined,
      from: typeof req.query.from === 'string' ? req.query.from : undefined,
      to: typeof req.query.to === 'string' ? req.query.to : undefined,
      page: req.query.page ? Number(req.query.page) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      sort: typeof req.query.sort === 'string' && req.query.sort === 'asc' ? 'asc' : 'desc',
    };

    try {
      const result = await indexer.queryEvents(options);
      res.json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get('/events/:id', async (req, res) => {
    if (!indexer.isReady()) {
      return res.status(503).json({ error: 'Indexer is not ready' });
    }

    try {
      const event = await indexer.getEventById(req.params.id);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      res.json(event);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.post('/refresh', async (_req, res) => {
    if (!indexer.isReady()) {
      return res.status(503).json({ error: 'Indexer is not ready' });
    }

    try {
      const result = await indexer.indexNewEvents();
      res.status(202).json(result);
    } catch (err: unknown) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
