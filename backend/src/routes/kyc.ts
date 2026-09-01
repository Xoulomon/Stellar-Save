import { Router } from 'express';

import { jwtAuthMiddleware } from '../auth_middleware';
import { AppError } from '../lib/errors';
import { logger } from '../logger';
import { submitKyc, getKycStatus, pollAndUpdateStatus, emitKycStatusChange, verifyKycWebhookSignature } from '../services/kyc';

import type { AuthenticatedRequest } from '../auth_middleware';
import type { Request, Response, NextFunction } from 'express';

export function createKycRouter(): Router {
  const router = Router();

  // POST /api/kyc/submit — authenticated user submits KYC fields
  router.post(
    '/submit',
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { fields } = req.body as { fields?: Record<string, string> };
      if (!fields || typeof fields !== 'object') {
        return next(new AppError('MISSING_FIELDS', 'fields object is required', 400));
      }
      try {
        const result = await submitKyc({
          userId: req.walletAddress!,
          walletAddress: req.walletAddress!,
          fields,
        });
        return res.status(201).json(result);
      } catch (err: any) {
        logger.error('[kyc] submit error', { error: err?.message });
        return next(new AppError('KYC_SUBMISSION_FAILED', 'KYC submission failed', 500));
      }
    }
  );

  // GET /api/kyc/status — get KYC status for the authenticated user
  router.get(
    '/status',
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        const result = await getKycStatus(req.walletAddress!);
        return res.json(result);
      } catch (err: any) {
        logger.error('[kyc] status error', { error: err?.message });
        return next(new AppError('KYC_STATUS_FETCH_FAILED', 'Failed to fetch KYC status', 500));
      }
    }
  );

  // POST /api/kyc/webhook — provider pushes status updates
  router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
    const secret = process.env['KYC_WEBHOOK_SECRET'] ?? '';
    if (secret) {
      const sig = (req.headers['x-kyc-signature'] as string) ?? '';
      const rawBody = JSON.stringify(req.body);
      if (!verifyKycWebhookSignature(secret, rawBody, sig)) {
        return next(new AppError('INVALID_SIGNATURE', 'Invalid signature', 401));
      }
    }

    const { userId, status } = req.body as { userId?: string; status?: string };
    if (!userId || !status) {
      return next(new AppError('MISSING_FIELDS', 'userId and status are required', 400));
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
      return next(new AppError('KYC_WEBHOOK_PROCESSING_FAILED', 'Webhook processing failed', 500));
    }
  });

  return router;
}
