import { Router } from 'express';
import { jwtAuthMiddleware, adminAuthMiddleware } from '../auth_middleware';
import {
  getAmbassadorLeaderboard,
  getAmbassadorProfile,
  evaluateAmbassadorStatus,
  distributeRewards,
  saveAmbassadorProfile,
} from '../ambassador_service';

export function createAmbassadorRouter(): Router {
  const router = Router();

  // GET /ambassadors/leaderboard — public
  router.get('/leaderboard', (_req, res) => {
    res.json(getAmbassadorLeaderboard());
  });

  // GET /ambassadors/:address — public
  router.get('/:address', (req, res) => {
    const profile = getAmbassadorProfile(req.params.address);
    if (!profile) return res.status(404).json({ error: 'Ambassador not found' });
    return res.json(profile);
  });

  // POST /ambassadors/evaluate — JWT protected
  router.post('/evaluate', jwtAuthMiddleware, (req, res) => {
    const { address, reputationScore, contributions, referrals } = req.body as {
      address: string;
      reputationScore: number;
      contributions: number;
      referrals: number;
    };

    if (!address || reputationScore == null || contributions == null || referrals == null) {
      return res.status(400).json({ error: 'Missing required fields: address, reputationScore, contributions, referrals' });
    }

    const tier = evaluateAmbassadorStatus(address, reputationScore, contributions, referrals);
    if (!tier) return res.json({ eligible: false, tier: null });

    const profile = saveAmbassadorProfile(address, tier, reputationScore, contributions, referrals);
    return res.json({ eligible: true, tier, profile });
  });

  // POST /ambassadors/:address/reward — admin protected
  router.post('/:address/reward', adminAuthMiddleware, (req, res) => {
    const { amount } = req.body as { amount: number };
    if (amount == null || amount <= 0) {
      return res.status(400).json({ error: 'amount must be a positive number' });
    }
    try {
      distributeRewards(req.params.address, amount);
      return res.json({ success: true });
    } catch (err: unknown) {
      return res.status(404).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  });

  return router;
}
