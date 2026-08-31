import { Router, NextFunction } from 'express';
import { jwtAuthMiddleware, requireSelf, AuthenticatedRequest } from '../auth_middleware';
import { AppError } from '../lib/errors';
import { logger } from '../logger';

/**
 * User routes — all protected by JWT authentication.
 * Mounted at /api/user in index.ts
 *
 * Every route here requires a valid Bearer JWT issued by /api/auth/verify.
 * Routes that expose per-user data also enforce requireSelf so users
 * cannot access each other's data.
 */
export function createUserRouter(): Router {
  const router = Router();

  // Apply JWT auth to every route in this router
  router.use(jwtAuthMiddleware);

  /**
   * GET /api/user/me
   * Returns the authenticated user's wallet address from the JWT.
   */
  router.get('/me', (req: AuthenticatedRequest, res) => {
    return res.json({ walletAddress: req.walletAddress });
  });

  /**
   * GET /api/user/:walletAddress/profile
   * Returns profile data for the given wallet address.
   * Enforces that the requester can only fetch their own profile.
   */
  router.get('/:walletAddress/profile', requireSelf, (req: AuthenticatedRequest, res) => {
    // Placeholder — replace with real DB lookup when user model exists
    return res.json({
      walletAddress: req.walletAddress,
      createdAt: new Date().toISOString(),
    });
  });

  /**
   * GET /api/user/:walletAddress/preferences
   * Returns notification/app preferences for the wallet owner.
   */
  router.get(
    '/:walletAddress/preferences',
    requireSelf,
    async (req: AuthenticatedRequest, res, next: NextFunction) => {
      try {
        const { UserPreferenceManager } = await import('../user_preference_manager');
        const prefs = await UserPreferenceManager.getOrCreatePreferences(req.walletAddress!);
        return res.json(prefs);
      } catch (error) {
        logger.error('Error fetching user preferences', { error: String(error) });
        return next(new AppError('PREFERENCES_FETCH_FAILED', 'Failed to fetch preferences', 500));
      }
    }
  );

  /**
   * PUT /api/user/:walletAddress/preferences
   * Updates notification/app preferences for the wallet owner.
   */
  router.put(
    '/:walletAddress/preferences',
    requireSelf,
    async (req: AuthenticatedRequest, res, next: NextFunction) => {
      try {
        const { UserPreferenceManager } = await import('../user_preference_manager');
        const updated = await UserPreferenceManager.updatePreferences(req.walletAddress!, req.body);
        return res.json({ message: 'Preferences updated', preferences: updated });
      } catch (error) {
        logger.error('Error updating user preferences', { error: String(error) });
        return next(new AppError('PREFERENCES_UPDATE_FAILED', 'Failed to update preferences', 500));
      }
    }
  );

  return router;
}
