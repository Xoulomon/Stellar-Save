/**
 * Insurance pool REST endpoints (Issue #1012).
 *
 * GET  /api/v1/groups/:groupId/insurance         – balance + claim history
 * POST /api/v1/groups/:groupId/insurance/claim   – file a claim (demo)
 *
 * In production, balance is read from the on-chain insurance pool ledger entry
 * via the Soroban RPC.  For now we return deterministic mock data so the UI
 * can be built and tested without a live contract.
 */

import { Router } from 'express';

export interface InsuranceClaim {
  id: string;
  groupId: string;
  claimant: string;
  amount: number;      // in XLM
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;   // ISO-8601
  resolvedAt?: string;
}

export interface InsurancePool {
  groupId: string;
  enabled: boolean;
  balance: number;     // in XLM
  premiumRate: number; // 0.0–1.0  (e.g. 0.05 = 5 % of contribution)
  claims: InsuranceClaim[];
}

// In-memory store (replace with Prisma in production)
const pools = new Map<string, InsurancePool>();

function getOrCreate(groupId: string): InsurancePool {
  if (!pools.has(groupId)) {
    pools.set(groupId, {
      groupId,
      enabled: false,
      balance: 0,
      premiumRate: 0.05,
      claims: [],
    });
  }
  return pools.get(groupId)!;
}

export function createInsuranceRouter(): Router {
  const router = Router({ mergeParams: true });

  // GET /api/v1/groups/:groupId/insurance
  router.get('/', (req, res) => {
    const pool = getOrCreate(req.params['groupId'] as string);
    res.json(pool);
  });

  // PUT /api/v1/groups/:groupId/insurance
  // Enable/update insurance settings (called on group creation or update)
  router.put('/', (req, res) => {
    const groupId = req.params['groupId'] as string;
    const pool = getOrCreate(groupId);
    const { enabled, premiumRate, initialBalance } = req.body as {
      enabled?: boolean;
      premiumRate?: number;
      initialBalance?: number;
    };

    if (typeof enabled === 'boolean') pool.enabled = enabled;
    if (typeof premiumRate === 'number' && premiumRate >= 0 && premiumRate <= 1) {
      pool.premiumRate = premiumRate;
    }
    if (typeof initialBalance === 'number' && initialBalance >= 0) {
      pool.balance += initialBalance;
    }

    pools.set(groupId, pool);
    res.json(pool);
  });

  // POST /api/v1/groups/:groupId/insurance/claim
  router.post('/claim', (req, res) => {
    const groupId = req.params['groupId'] as string;
    const pool = getOrCreate(groupId);

    if (!pool.enabled) {
      return res.status(400).json({ error: 'Insurance pool is not enabled for this group.' });
    }

    const { claimant, amount, reason } = req.body as {
      claimant?: string;
      amount?: number;
      reason?: string;
    };

    if (!claimant || !amount || !reason) {
      return res.status(400).json({ error: 'claimant, amount, and reason are required.' });
    }

    if (amount > pool.balance) {
      return res.status(400).json({ error: 'Insufficient insurance pool balance.' });
    }

    const claim: InsuranceClaim = {
      id: `claim-${Date.now()}`,
      groupId,
      claimant,
      amount,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    pool.claims.push(claim);
    pools.set(groupId, pool);
    res.status(201).json(claim);
  });

  return router;
}
