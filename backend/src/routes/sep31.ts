import { Router, Response, NextFunction } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import { getQuote, sendPayment, getPaymentStatus } from '../services/sep31';
import { logger } from '../logger';
import { AppError } from '../lib/errors';

export function createSep31Router(): Router {
  const router = Router();

  // GET /api/sep31/quote?anchorDomain=&sendAsset=&receiveAsset=&amount=
  router.get('/quote', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { anchorDomain, sendAsset, receiveAsset, amount } = req.query as Record<string, string>;
    if (!anchorDomain || !sendAsset || !receiveAsset || !amount) {
      return next(new AppError('MISSING_FIELDS', 'anchorDomain, sendAsset, receiveAsset, amount are required', 400));
    }
    try {
      const quote = await getQuote({ anchorDomain, sendAsset, receiveAsset, amount });
      return res.json(quote);
    } catch (err: any) {
      logger.error('[sep31] quote error', { error: err?.message });
      return next(new AppError('QUOTE_FETCH_FAILED', 'Failed to get quote', 502, err?.message));
    }
  });

  // POST /api/sep31/send
  router.post('/send', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { anchorDomain, sendAssetCode, receiveAssetCode, amount, receiverId, fields, groupId } = req.body as Record<string, any>;
    if (!anchorDomain || !sendAssetCode || !receiveAssetCode || !amount || !receiverId) {
      return next(new AppError('MISSING_FIELDS', 'anchorDomain, sendAssetCode, receiveAssetCode, amount, receiverId are required', 400));
    }
    try {
      const result = await sendPayment({
        anchorDomain,
        sendAssetCode,
        receiveAssetCode,
        amount,
        senderId: req.walletAddress!,
        receiverId,
        fields: fields ?? {},
        groupId,
      });
      return res.status(201).json(result);
    } catch (err: any) {
      logger.error('[sep31] send error', { error: err?.message });
      const isValidation = err?.message?.includes('Missing required compliance');
      return next(new AppError(
        isValidation ? 'MISSING_COMPLIANCE_FIELDS' : 'SEP31_SEND_FAILED',
        err?.message ?? 'Send failed',
        isValidation ? 422 : 502
      ));
    }
  });

  // GET /api/sep31/:id/status?anchorDomain=
  router.get('/:id/status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const { anchorDomain } = req.query as { anchorDomain?: string };
    if (!anchorDomain) return next(new AppError('MISSING_FIELDS', 'anchorDomain query param is required', 400));
    try {
      const status = await getPaymentStatus(anchorDomain, req.params.id);
      return res.json(status);
    } catch (err: any) {
      logger.error('[sep31] status error', { error: err?.message });
      return next(new AppError('SEP31_STATUS_NOT_FOUND', err?.message ?? 'Not found', 404));
    }
  });

  return router;
}
