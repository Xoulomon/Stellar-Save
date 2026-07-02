import { Router, Request, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import { submitKyc, getKycStatus, pollAndUpdateStatus, emitKycStatusChange, verifyKycWebhookSignature } from '../services/kyc';
import { logger } from '../logger';

export function createKycRouter(): Router {
  const router = Router();

  // POST /api/kyc/submit — authenticated user submits KYC fields
  router.post('/submit', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { fields } = req.body as { fields?: Record<string, string> };
    if (!fields || typeof fields !== 'object') {
      return res.status(400).json({ error: 'fields object is required' });
    }
    try {
      const result = await submitKyc({ userId: req.walletAddress!, walletAddress: req.walletAddress!, fields });
      return res.status(201).json(result);
    } catch (err: any) {
      logger.error('[kyc] submit error', { error: err?.message });
      return res.status(500).json({ error: 'KYC submission failed' });
    }
  });

  // GET /api/kyc/status — get KYC status for the authenticated user
  router.get('/status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const result = await getKycStatus(req.walletAddress!);
      return res.json(result);
    } catch (err: any) {
      logger.error('[kyc] status error', { error: err?.message });
      return res.status(500).json({ error: 'Failed to fetch KYC status' });
    }
  });

  // POST /api/kyc/webhook — provider pushes status updates
  router.post('/webhook', async (req: Request, res: Response) => {
    const secret = process.env['KYC_WEBHOOK_SECRET'] ?? '';
    if (secret) {
      const sig = req.headers['x-kyc-signature'] as string ?? '';
      const rawBody = JSON.stringify(req.body);
      if (!verifyKycWebhookSignature(secret, rawBody, sig)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }
    }

    const { userId, status } = req.body as { userId?: string; status?: string };
    if (!userId || !status) {
      return res.status(400).json({ error: 'userId and status are required' });
    }

    try {
      const current = await getKycStatus(userId);
      if (current.status !== status) {
        await emitKycStatusChange(userId, current.status, status);
        await pollAndUpdateStatus(userId);
      }
      return res.json({ ok: true });
    } catch (err: any) {
      logger.error('[kyc] webhook processing failed', { error: err?.message });
      return res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  return router;
}
