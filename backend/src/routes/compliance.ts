import { Router } from 'express';

import {
  screenTransaction,
  flagTransaction,
  getFlaggedTransactions,
  reviewFlag,
  getAuditLog,
} from '../aml_service';
import { adminAuthMiddleware, jwtAuthMiddleware } from '../modules/auth/auth_middleware';
import { AppError } from '../lib/errors';
import { parseOffsetParams, paginateArray } from '../lib/pagination';
import {
  createEnvelope,
  createEnvelopeWithPagination,
  errorEnvelope,
  createEmptyEnvelope,
} from '../lib/response-envelope';

import type { AuthenticatedRequest } from '../modules/auth/auth_middleware';
import type { Response, NextFunction } from 'express';

export function createComplianceRouter(): Router {
  const router = Router();

  // POST /compliance/screen
  router.post(
    '/screen',
    jwtAuthMiddleware,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { address, txHash, amount } = req.body as {
        address: string;
        txHash: string;
        amount: number;
      };
      if (!address || !txHash || amount == null) {
        return next(
          new AppError('MISSING_FIELDS', 'address, txHash, and amount are required', 400)
        );
      }
      const result = screenTransaction(address, txHash, Number(amount));
      if (result.flagged) {
        flagTransaction(address, txHash, result);
      }
      return res.json(createEnvelope(result));
    }
  );

  // GET /compliance/queue
  router.get(
    '/queue',
    adminAuthMiddleware,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const params = parseOffsetParams(req.query as Record<string, unknown>);
        const result = paginateArray(getFlaggedTransactions(), params);
        return res.json(createEnvelopeWithPagination(result));
      } catch (err: unknown) {
        return next(err);
      }
    }
  );

  // POST /compliance/flags/:id/review
  router.post(
    '/flags/:id/review',
    adminAuthMiddleware,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const { decision, notes } = req.body as { decision: 'approved' | 'rejected'; notes?: string };
      if (!decision || !['approved', 'rejected'].includes(decision)) {
        return next(
          new AppError('INVALID_DECISION', 'decision must be "approved" or "rejected"', 400)
        );
      }
      try {
        reviewFlag(id, req.adminId ?? 'admin', decision, notes);
        return res.json(createEmptyEnvelope({ reviewed: true }));
      } catch (err: unknown) {
        return next(
          new AppError('FLAG_REVIEW_FAILED', err instanceof Error ? err.message : 'Not found', 404)
        );
      }
    }
  );

  // GET /compliance/audit-log
  router.get(
    '/audit-log',
    adminAuthMiddleware,
    (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const params = parseOffsetParams(req.query as Record<string, unknown>);
        const result = paginateArray(getAuditLog(), params);
        return res.json(createEnvelopeWithPagination(result));
      } catch (err: unknown) {
        return next(err);
      }
    }
  );

  return router;
}
