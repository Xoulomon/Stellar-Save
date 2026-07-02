import { Router, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import { getQuote, sendPayment, getPaymentStatus } from '../services/sep31';
import { logger } from '../logger';

export function createSep31Router(): Router {
  const router = Router();

  // GET /api/sep31/quote?anchorDomain=&sendAsset=&receiveAsset=&amount=
  router.get('/quote', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { anchorDomain, sendAsset, receiveAsset, amount } = req.query as Record<string, string>;
    if (!anchorDomain || !sendAsset || !receiveAsset || !amount) {
      return res.status(400).json({ error: 'anchorDomain, sendAsset, receiveAsset, amount are required' });
    }
    try {
      const quote = await getQuote({ anchorDomain, sendAsset, receiveAsset, amount });
      return res.json(quote);
    } catch (err: any) {
      logger.error('[sep31] quote error', { error: err?.message });
      return res.status(502).json({ error: 'Failed to get quote', detail: err?.message });
    }
  });

  // POST /api/sep31/send
  router.post('/send', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { anchorDomain, sendAssetCode, receiveAssetCode, amount, receiverId, fields, groupId } = req.body as Record<string, any>;
    if (!anchorDomain || !sendAssetCode || !receiveAssetCode || !amount || !receiverId) {
      return res.status(400).json({ error: 'anchorDomain, sendAssetCode, receiveAssetCode, amount, receiverId are required' });
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
      return res.status(isValidation ? 422 : 502).json({ error: err?.message ?? 'Send failed' });
    }
  });

  // GET /api/sep31/:id/status?anchorDomain=
  router.get('/:id/status', jwtAuthMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    const { anchorDomain } = req.query as { anchorDomain?: string };
    if (!anchorDomain) return res.status(400).json({ error: 'anchorDomain query param is required' });
    try {
      const status = await getPaymentStatus(anchorDomain, req.params.id);
      return res.json(status);
    } catch (err: any) {
      logger.error('[sep31] status error', { error: err?.message });
      return res.status(404).json({ error: err?.message ?? 'Not found' });
    }
  });

  return router;
}
