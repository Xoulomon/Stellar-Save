import { Router, Request, Response, NextFunction } from 'express';
import {
  generateChallenge,
  verifySignature,
  issueJwt,
  issueRefreshToken,
  rotateRefreshToken,
  revokeSession,
  revokeAllSessions,
} from '../auth_service';
import { jwtAuthMiddleware, AuthenticatedRequest } from '../auth_middleware';
import { logger } from '../logger';
import { AppError } from '../lib/errors';
import { validateBody, schemas } from '../lib/validation';

/**
 * Auth routes for Stellar wallet-based authentication.
 *
 * POST /api/auth/challenge          — Request sign challenge
 * POST /api/auth/verify             — Verify signature → access + refresh tokens
 * POST /api/auth/refresh            — Rotate refresh token → new token pair
 * POST /api/auth/logout             — Revoke current session family
 * POST /api/auth/logout-everywhere  — Revoke all sessions for the wallet (requires JWT)
 *
 * Note: Legacy endpoints /auth/login-old and /auth/refresh-legacy have been
 * removed (issue #38). Clients must use the current endpoints above.
 */
export function createAuthRouter(): Router {
  const router = Router();

  // POST /api/auth/challenge
  router.post(
    '/challenge',
    validateBody(schemas.authChallenge),
    async (req: Request, res: Response, next: NextFunction) => {
      const { walletAddress } = req.body;
      try {
        const challenge = await generateChallenge(walletAddress);
        logger.info('Auth challenge issued', { walletAddress });
        return res.status(200).json({ challenge });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate challenge';
        logger.warn('Auth challenge failed', { walletAddress, error: message });
        return next(new AppError('CHALLENGE_FAILED', message, 400));
      }
    }
  );

  // POST /api/auth/verify
  router.post(
    '/verify',
    validateBody(schemas.authVerify),
    async (req: Request, res: Response, next: NextFunction) => {
      const { walletAddress, challenge, signature } = req.body;

      try {
        const isValid = await verifySignature(walletAddress, challenge, signature);

        if (!isValid) {
          logger.warn('Auth verification failed — invalid signature', { walletAddress });
          return next(new AppError('INVALID_SIGNATURE', 'Invalid signature', 401));
        }

        const accessToken = issueJwt(walletAddress);
        const refreshToken = await issueRefreshToken(walletAddress);
        logger.info('Auth verification successful', { walletAddress });
        return res.status(200).json({ accessToken, refreshToken });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Verification failed';
        logger.warn('Auth verify error', { walletAddress, error: message });
        return next(new AppError('VERIFICATION_FAILED', message, 401));
      }
    }
  );

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   * Returns: { accessToken, refreshToken }
   *
   * Rotates the refresh token (one-time-use). Reuse invalidates the whole session family.
   */
  router.post(
    '/refresh',
    validateBody(schemas.authRefresh),
    async (req: Request, res: Response, next: NextFunction) => {
      const { refreshToken } = req.body;
      try {
        const tokens = await rotateRefreshToken(refreshToken);
        return res.status(200).json(tokens);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Token rotation failed';
        logger.warn('Refresh token rotation failed', { error: message });
        // 401 for all token errors — don't leak internal reason on reuse
        return next(new AppError('TOKEN_ROTATION_FAILED', message, 401));
      }
    }
  );

  /**
   * POST /api/auth/logout
   * Body: { refreshToken }
   * Revokes the session family containing this token (no JWT required — token is proof).
   */
  router.post(
    '/logout',
    validateBody(schemas.authRefresh),
    async (req: Request, res: Response) => {
      const { refreshToken } = req.body;
      try {
        await revokeSession(refreshToken);
        return res.status(200).json({ message: 'Logged out' });
      } catch (error) {
        logger.warn('Logout error', { error: String(error) });
        return res.status(200).json({ message: 'Logged out' }); // idempotent
      }
    }
  );

  /**
   * POST /api/auth/logout-everywhere
   * Requires: Authorization: Bearer <accessToken>
   * Immediately revokes ALL refresh token sessions for the authenticated wallet.
   */
  router.post(
    '/logout-everywhere',
    jwtAuthMiddleware,
    async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      try {
        await revokeAllSessions(req.walletAddress!);
        logger.info('All sessions revoked', { walletAddress: req.walletAddress });
        return res.status(200).json({ message: 'All sessions revoked' });
      } catch (error) {
        logger.error('logout-everywhere error', { error: String(error) });
        return next(new AppError('REVOKE_SESSIONS_FAILED', 'Failed to revoke sessions', 500));
      }
    }
  );

  return router;
}
