import { Router, type Request, type Response } from 'express';
import { buildCostReport } from '../aws_cost_service';
import logger from '../logger';

export function createCostRouter(): Router {
  const router = Router();

  /**
   * GET /api/v1/costs/report
   * Returns AWS cost breakdown, forecast, and Compute Optimizer recommendations.
   * Protected by x-admin-secret header (same as other admin routes).
   */
  router.get('/report', async (_req: Request, res: Response) => {
    try {
      const report = await buildCostReport();
      res.json(report);
    } catch (err) {
      logger.error({ err }, 'Failed to build cost report');
      res.status(500).json({ error: 'Failed to fetch cost data from AWS' });
    }
  });

  return router;
}
