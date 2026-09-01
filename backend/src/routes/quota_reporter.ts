import { Router } from 'express';

import { jwtAuthMiddleware } from '../auth_middleware';
import { AppError } from '../lib/errors';
import { getQuotaUsage, getTierConfig, getConfiguredTiers } from '../redis_rate_limiter';

import type { Request, Response, NextFunction } from 'express';

export function createQuotaReporterRouter(): Router {
  const router = Router();

  router.get(
    '/usage',
    jwtAuthMiddleware,
    async (req: Request, res: Response, next: NextFunction) => {
      const r = req as any;
      const userId = r.userId || r.user?.id;

      if (!userId) {
        next(new AppError('UNAUTHORIZED', 'Authentication required', 401));
        return;
      }

      const tier = r.apiKey?.tier || 'pro';
      const usage = await getQuotaUsage(userId, tier);

      res.json({
        userId,
        tier,
        usage,
      });
    }
  );

  router.get('/tiers', jwtAuthMiddleware, async (_req: Request, res: Response) => {
    const tiers = getConfiguredTiers();
    const configs: Record<string, any> = {};
    for (const tier of tiers) {
      const cfg = getTierConfig(tier);
      if (cfg) {
        configs[tier] = cfg.windows.map((w) => ({
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
