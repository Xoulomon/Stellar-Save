import { Router, Request, Response } from 'express';
import { jwtAuthMiddleware } from '../auth_middleware';
import { getQuotaUsage, getTierConfig, getConfiguredTiers } from '../redis_rate_limiter';

export function createQuotaReporterRouter(): Router {
  const router = Router();

  router.get('/usage', jwtAuthMiddleware, async (req: Request, res: Response) => {
    const r = req as any;
    const userId = r.userId || r.user?.id;

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tier = r.apiKey?.tier || 'pro';
    const usage = await getQuotaUsage(userId, tier);

    res.json({
      userId,
      tier,
      usage,
    });
  });

  router.get('/tiers', jwtAuthMiddleware, async (_req: Request, res: Response) => {
    const tiers = getConfiguredTiers();
    const configs: Record<string, any> = {};
    for (const tier of tiers) {
      const cfg = getTierConfig(tier);
      if (cfg) {
        configs[tier] = cfg.windows.map(w => ({
          window: w.label,
          windowMs: w.windowMs,
          max: w.max,
        }));
      }
    }

    res.json({ tiers: configs });
  });

  return router;
}
