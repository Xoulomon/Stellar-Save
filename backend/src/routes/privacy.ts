import { Router, Response } from 'express';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import {
  exportUserData,
  deleteUserData,
  createPrivacyRequest,
  completePrivacyRequest,
} from '../privacy_service';
import { logger } from '../logger';

/**
 * Privacy routes — GDPR/CCPA data rights (Issue #1107)
 *
 * All routes require a valid JWT. Users can only operate on their own data.
 *
 * GET  /api/privacy/export   — Download a JSON export of all personal data
 * POST /api/privacy/delete   — Permanently delete all personal data
 * GET  /api/privacy/requests — List past privacy requests
 */
export function createPrivacyRouter(): Router {
  const router = Router();

  // Every privacy route requires authentication
  router.use(jwtAuthMiddleware);

  /**
   * GET /api/privacy/export
   *
   * Collects and returns all PII associated with the authenticated wallet.
   * Response is served as application/json with a content-disposition header
   * so browsers treat it as a file download.
   */
  router.get('/export', async (req: AuthenticatedRequest, res: Response) => {
    const walletAddress = req.walletAddress!;
    let requestId: string | undefined;

    try {
      const req_ = await createPrivacyRequest(walletAddress, 'export');
      requestId = req_.id;

      const data = await exportUserData(walletAddress);

      await completePrivacyRequest(requestId, 'completed');

      logger.info('Privacy export completed', { walletAddress });
      res.setHeader('Content-Disposition', `attachment; filename="stellar-save-data-export.json"`);
      return res.status(200).json(data);
    } catch (error) {
      if (requestId) await completePrivacyRequest(requestId, 'failed').catch(() => {});
      logger.error('Privacy export failed', { walletAddress, error: String(error) });
      return res.status(500).json({ error: 'Failed to export data' });
    }
  });

  /**
   * POST /api/privacy/delete
   *
   * Permanently deletes all PII for the authenticated wallet.
   * This action is irreversible. The request itself is retained in PrivacyRequest
   * as an audit trail (legal obligation).
   */
  router.post('/delete', async (req: AuthenticatedRequest, res: Response) => {
    const walletAddress = req.walletAddress!;
    let requestId: string | undefined;

    try {
      const req_ = await createPrivacyRequest(walletAddress, 'deletion');
      requestId = req_.id;

      await deleteUserData(walletAddress);

      await completePrivacyRequest(requestId, 'completed');

      logger.info('Privacy deletion completed', { walletAddress });
      return res.status(200).json({ message: 'All personal data has been permanently deleted.' });
    } catch (error) {
      if (requestId) await completePrivacyRequest(requestId, 'failed').catch(() => {});
      logger.error('Privacy deletion failed', { walletAddress, error: String(error) });
      return res.status(500).json({ error: 'Failed to delete data' });
    }
  });

  /**
   * GET /api/privacy/requests
   *
   * Returns the history of privacy requests (export/deletion) for the authenticated wallet.
   */
  router.get('/requests', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { prisma } = await import('../prisma_client');
      const requests = await prisma.privacyRequest.findMany({
        where: { walletAddress: req.walletAddress! },
        orderBy: { createdAt: 'desc' },
      });
      return res.status(200).json({ requests });
    } catch (error) {
      logger.error('Error fetching privacy requests', { error: String(error) });
      return res.status(500).json({ error: 'Failed to fetch privacy requests' });
    }
  });

  return router;
}
