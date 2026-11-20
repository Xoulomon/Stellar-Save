import { Router } from 'express';

import { jwtAuthMiddleware, requireSelf } from '../modules/auth/auth_middleware';
import { AppError } from '../lib/errors';
import { parsePagination, buildPaginatedResponse } from '../lib/pagination';
import { logger } from '../logger';

import type { AuthenticatedRequest } from '../modules/auth/auth_middleware';
import type { NextFunction } from 'express';

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
   * GET /api/user/:walletAddress/preferences/history
   * Returns a paginated list of preference change history for the wallet owner.
   * Uses the shared pagination helpers so query parsing and response shape
   * stay consistent with other list endpoints.
   */
  router.get(
    '/:walletAddress/preferences/history',
    requireSelf,
    async (req: AuthenticatedRequest, res, next: NextFunction) => {
      try {
        const { page, limit } = parsePagination(req.query as Record<string, unknown>);
        const { UserPreferenceManager } = await import('../user_preference_manager');
        const { items, total } = await UserPreferenceManager.getPreferenceHistory(
          req.walletAddress!,
          { page, limit }
        );
        return res.json(buildPaginatedResponse(items, total, page, limit));
      } catch (error) {
        logger.error('Error fetching preference history', { error: String(error) });
        return next(
          new AppError('PREFERENCES_HISTORY_FETCH_FAILED', 'Failed to fetch preference history', 500)
        );
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
