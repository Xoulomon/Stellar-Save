import { Router, Request, Response } from 'express';
import { V1Services } from './v1';

/**
 * Transforms a v1 response shape into v2 shape.
 * Extend this as v2 diverges from v1.
 */
export function migrateV1ToV2<T extends Record<string, unknown>>(v1Response: T): T & { apiVersion: 'v2' } {
  return { ...v1Response, apiVersion: 'v2' as const };
}

export function createV2Router(services: V1Services): Router {
  const router = Router();
  const { engine, backupService } = services;

  // Health — v2 adds uptime
  router.get('/health', (_req: Request, res: Response) => {
    res.json(migrateV1ToV2({ status: 'ok', version: 'v2', uptime: process.uptime() }));
  });

  // Recommendations — v2 always uses collaborative filtering and returns richer metadata
  router.get('/recommendations/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;
    const recommendations = engine.getRecommendations(userId, 'collaborative');
    res.json(migrateV1ToV2({ userId, algorithm: 'collaborative', recommendations }));
  });

  // Backup list — v2 adds pagination
  router.get('/backup', (req: Request, res: Response) => {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const all = backupService.listJobs();
    const start = (page - 1) * limit;
    res.json(migrateV1ToV2({
      data: all.slice(start, start + limit),
      total: all.length,
      page,
      limit,
    }));
  });

  // All other v2 routes are stubs — return 501 with migration hint
  router.use((req: Request, res: Response) => {
    res.status(501).json({
      error: 'Not implemented in v2 yet',
      hint: `Try the v1 equivalent: /api/v1${req.path}`,
      apiVersion: 'v2',
    });
  });

  return router;
}
