import { Router, type Request, type Response, type NextFunction } from 'express';

import { buildCostReport } from '../aws_cost_service';
import { AppError } from '../lib/errors';
import logger from '../logger';

export function createCostRouter(): Router {
  const router = Router();

  /**
   * GET /api/v1/costs/report
   * Returns AWS cost breakdown, forecast, and Compute Optimizer recommendations.
   * Protected by x-admin-secret header (same as other admin routes).
   */
  router.get('/report', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const report = await buildCostReport();
      res.json(report);
    } catch (err) {
      logger.error({ err }, 'Failed to build cost report');
      next(new AppError('COST_REPORT_FAILED', 'Failed to fetch cost data from AWS', 500));
    }
  });

  return router;
}
