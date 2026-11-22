import { Router } from 'express';

import { AppError } from '../lib/errors';
import { logger } from '../logger';
import { jwtAuthMiddleware } from '../modules/auth/auth_middleware';
import { getQuote, sendPayment, getPaymentStatus } from '../services/sep31';

import type { AuthenticatedRequest } from '../modules/auth/auth_middleware';
import type { Response, NextFunction } from 'express';

export function createSep31Router(): Router {
  const router = Router();

  // GET /api/sep31/quote?anchorDomain=&sendAsset=&receiveAsset=&amount=
  router.get(
    '/quote',
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { anchorDomain, sendAsset, receiveAsset, amount } = req.query as Record<string, string>;
      if (!anchorDomain || !sendAsset || !receiveAsset || !amount) {
        return next(
          new AppError(
            'MISSING_FIELDS',
            'anchorDomain, sendAsset, receiveAsset, amount are required',
            400
          )
        );
      }
      try {
        const quote = await getQuote({ anchorDomain, sendAsset, receiveAsset, amount });
        return res.json(quote);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('[sep31] quote error', { error: errorMsg });
        return next(new AppError('QUOTE_FETCH_FAILED', 'Failed to get quote', 502, errorMsg));
      }
    }
  );

  // POST /api/sep31/send
  router.post(
    '/send',
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { anchorDomain, sendAssetCode, receiveAssetCode, amount, receiverId, fields, groupId } =
        req.body as Record<string, unknown>;
      if (!anchorDomain || !sendAssetCode || !receiveAssetCode || !amount || !receiverId) {
        return next(
          new AppError(
            'MISSING_FIELDS',
            'anchorDomain, sendAssetCode, receiveAssetCode, amount, receiverId are required',
            400
          )
        );
      }
      try {
        const result = await sendPayment({
          anchorDomain: String(anchorDomain),
          sendAssetCode: String(sendAssetCode),
          receiveAssetCode: String(receiveAssetCode),
          amount: String(amount),
          senderId: req.walletAddress!,
          receiverId: String(receiverId),
          fields: (fields as Record<string, unknown>) ?? {},
          groupId: groupId ? String(groupId) : undefined,
        });
        return res.status(201).json(result);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('[sep31] send error', { error: errorMsg });
        const isValidation = errorMsg.includes('Missing required compliance');
        return next(
          new AppError(
            isValidation ? 'MISSING_COMPLIANCE_FIELDS' : 'SEP31_SEND_FAILED',
            errorMsg || 'Send failed',
            isValidation ? 422 : 502
          )
        );
      }
    }
  );

  // GET /api/sep31/:id/status?anchorDomain=
  router.get(
    '/:id/status',
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      const { anchorDomain } = req.query as { anchorDomain?: string };
      if (!anchorDomain)
        return next(new AppError('MISSING_FIELDS', 'anchorDomain query param is required', 400));
      try {
        const status = await getPaymentStatus(anchorDomain, req.params.id);
        return res.json(status);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('[sep31] status error', { error: errorMsg });
        return next(new AppError('SEP31_STATUS_NOT_FOUND', errorMsg || 'Not found', 404));
      }
    }
  );

  return router;
}
