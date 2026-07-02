import { Router, Response } from 'express';
import { adminAuthMiddleware, jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import {
  screenTransaction,
  flagTransaction,
  getFlaggedTransactions,
  reviewFlag,
  getAuditLog,
} from '../aml_service';

export function createComplianceRouter(): Router {
  const router = Router();

  // POST /compliance/screen
  router.post('/screen', jwtAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { address, txHash, amount } = req.body as { address: string; txHash: string; amount: number };
    if (!address || !txHash || amount == null) {
      return res.status(400).json({ error: 'address, txHash, and amount are required' });
    }
    const result = screenTransaction(address, txHash, Number(amount));
    if (result.flagged) {
      flagTransaction(address, txHash, result);
    }
    return res.json(result);
  });

  // GET /compliance/queue
  router.get('/queue', adminAuthMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.json(getFlaggedTransactions());
  });

  // POST /compliance/flags/:id/review
  router.post('/flags/:id/review', adminAuthMiddleware, (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { decision, notes } = req.body as { decision: 'approved' | 'rejected'; notes?: string };
    if (!decision || !['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "approved" or "rejected"' });
    }
    try {
      reviewFlag(id, req.adminId ?? 'admin', decision, notes);
      return res.json({ success: true });
    } catch (err: unknown) {
      return res.status(404).json({ error: err instanceof Error ? err.message : 'Not found' });
    }
  });

  // GET /compliance/audit-log
  router.get('/audit-log', adminAuthMiddleware, (_req: AuthenticatedRequest, res: Response) => {
    return res.json(getAuditLog());
  });

  return router;
}
