import { Router } from 'express';

import {
  getAmbassadorLeaderboard,
  getAmbassadorProfile,
  evaluateAmbassadorStatus,
  distributeRewards,
  saveAmbassadorProfile,
} from '../ambassador_service';
import { jwtAuthMiddleware, adminAuthMiddleware } from '../modules/auth/auth_middleware';
import { AppError } from '../lib/errors';
import { parseOffsetParams, paginateArray } from '../lib/pagination';
import {
  createEnvelope,
  createEnvelopeWithPagination,
  createEmptyEnvelope,
} from '../lib/response-envelope';

import type { NextFunction } from 'express';

export function createAmbassadorRouter(): Router {
  const router = Router();

  // GET /ambassadors/leaderboard — public
  router.get('/leaderboard', (req, res, next: NextFunction) => {
    try {
      const { offset, limit } = parseOffsetParams(req.query as Record<string, unknown>);
      const { items, total } = paginateArray(getAmbassadorLeaderboard(), offset, limit);
      res.json(createEnvelopeWithPagination(items, { offset, limit, total }));
    } catch (err: unknown) {
      next(err);
    }
  });

  // GET /ambassadors/:address — public
  router.get('/:address', (req, res, next: NextFunction) => {
    const profile = getAmbassadorProfile(req.params.address);
    if (!profile) return next(new AppError('AMBASSADOR_NOT_FOUND', 'Ambassador not found', 404));
    return res.json(createEnvelope(profile));
  });

  // POST /ambassadors/evaluate — JWT protected
  router.post('/evaluate', jwtAuthMiddleware, (req, res, next: NextFunction) => {
    const { address, reputationScore, contributions, referrals } = req.body as {
      address: string;
      reputationScore: number;
      contributions: number;
      referrals: number;
    };

    if (!address || reputationScore == null || contributions == null || referrals == null) {
      return next(
        new AppError(
          'MISSING_FIELDS',
          'Missing required fields: address, reputationScore, contributions, referrals',
          400
        )
      );
    }

    const tier = evaluateAmbassadorStatus(address, reputationScore, contributions, referrals);
    if (!tier) return res.json(createEnvelope({ eligible: false, tier: null, profile: null }));

    const profile = saveAmbassadorProfile(address, tier, reputationScore, contributions, referrals);
    return res.json(createEnvelope({ eligible: true, tier, profile }));
  });

  // POST /ambassadors/:address/reward — admin protected
  router.post('/:address/reward', adminAuthMiddleware, (req, res, next: NextFunction) => {
    const { amount } = req.body as { amount: number };
    if (amount == null || amount <= 0) {
      return next(new AppError('INVALID_AMOUNT', 'amount must be a positive number', 400));
    }
    try {
      distributeRewards(req.params.address, amount);
      return res.json(createEmptyEnvelope({ rewarded: true, amount }));
    } catch (err: unknown) {
      return next(
        new AppError(
          'AMBASSADOR_REWARD_FAILED',
          err instanceof Error ? err.message : 'Unknown error',
          404
        )
      );
    }
  });

  return router;
}
