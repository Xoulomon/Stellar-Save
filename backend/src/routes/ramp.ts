import { Router, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import { initiateDeposit, initiateWithdraw, syncTransactionStatus, getTransaction } from '../services/sep24';
import { getKycStatus } from '../services/kyc';
import { logger } from '../logger';
import { rampProtection } from '../fiat_ramp_protection';

export function createRampRouter(): Router {
  const router = Router();

  // POST /api/ramp/deposit
  router.post('/deposit', jwtAuthMiddleware, rampProtection({ velocityCheck: true }), async (req: AuthenticatedRequest, res: Response) => {
    const { anchorDomain, assetCode, assetIssuer, amount, stellarAccount } = req.body as Record<string, string>;
    if (!anchorDomain || !assetCode || !stellarAccount) {
      return res.status(400).json({ error: 'anchorDomain, assetCode, stellarAccount are required' });
    }
    const kyc = await getKycStatus(req.walletAddress!);
    if (kyc.status !== 'approved') {
      return res.status(403).json({ error: 'KYC approval required to use fiat ramp', kycStatus: kyc.status });
    }
    try {
      const result = await initiateDeposit({ anchorDomain, assetCode, assetIssuer, amount, stellarAccount, userId: req.walletAddress! });
      return res.status(201).json(result);
    } catch (err: any) {
      logger.error('[ramp] deposit initiation failed', { error: err?.message });
      return res.status(502).json({ error: 'Failed to initiate deposit', detail: err?.message });
    }
  });

  // POST /api/ramp/withdraw
  router.post('/withdraw', jwtAuthMiddleware, rampProtection({ velocityCheck: true }), async (req: AuthenticatedRequest, res: Response) => {
    const { anchorDomain, assetCode, assetIssuer, amount, stellarAccount } = req.body as Record<string, string>;
    if (!anchorDomain || !assetCode || !stellarAccount) {
      return res.status(400).json({ error: 'anchorDomain, assetCode, stellarAccount are required' });
    }
    const kyc = await getKycStatus(req.walletAddress!);
    if (kyc.status !== 'approved') {
      return res.status(403).json({ error: 'KYC approval required to use fiat ramp', kycStatus: kyc.status });
    }
    try {
      const result = await initiateWithdraw({ anchorDomain, assetCode, assetIssuer, amount, stellarAccount, userId: req.walletAddress! });
      return res.status(201).json(result);
    } catch (err: any) {
      logger.error('[ramp] withdraw initiation failed', { error: err?.message });
      return res.status(502).json({ error: 'Failed to initiate withdraw', detail: err?.message });
    }
  });

  // GET /api/ramp/:id/status — sync and return latest status
  router.get('/:id/status', jwtAuthMiddleware, rampProtection({ velocityCheck: false }), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await syncTransactionStatus(req.params.id);
      return res.json(record);
    } catch (err: any) {
      logger.error('[ramp] status sync failed', { error: err?.message });
      return res.status(404).json({ error: err?.message ?? 'Not found' });
    }
  });

  // GET /api/ramp/:id
  router.get('/:id', jwtAuthMiddleware, rampProtection({ velocityCheck: false }), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const record = await getTransaction(req.params.id);
      return res.json(record);
    } catch (err: any) {
      return res.status(404).json({ error: err?.message ?? 'Not found' });
    }
  });

  return router;
}
