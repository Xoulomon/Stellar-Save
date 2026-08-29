/**
 * Rate limiting strategy for write-heavy mutation endpoints.
 * Issue #1507: Protect public mutation routes from abuse/DoS.
 *
 * Applied to:
 *   POST /api/auth/*              — Authentication mutations (challenge, verify, refresh, logout)
 *   POST /api/ramp/*              — Fiat ramp deposit/withdraw (sensitive)
 *   POST /api/kyc/*               — KYC submission (sensitive)
 *   POST /api/sep31/*             — Cross-border transfers (sensitive)
 *   POST /api/v1/groups/:id/join  — Group mutations
 *   POST /api/v1/contributions/*  — Contribution mutations
 *   POST /api/webhooks            — Webhook registration (requires auth)
 *
 * Rate limit tiers are configured in config.ts and applied via createTieredRateLimiter().
 * See backend/src/redis_rate_limiter.ts for implementation.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createAuthRateLimiterMiddleware } from '../rate_limiter';
import { logger } from '../logger';

/**
 * Stricter rate limiting for mutation endpoints.
 * - Auth endpoints: 10 req/15min per IP
 * - Public write endpoints: tiered based on user plan
 * - Admin endpoints: 5 req/15min per IP
 */
@Injectable()
export class MutationRateLimitMiddleware implements NestMiddleware {
  private middleware = createAuthRateLimiterMiddleware();

  use(req: Request, res: Response, next: NextFunction) {
    logger.debug('Mutation rate limit check', {
      method: req.method,
      path: req.path,
      ip: req.ip,
      userId: (req as any).userId,
    });

    this.middleware(req, res, next);
  }
}

/**
 * Endpoint cost configuration for tiered rate limiting.
 * Higher cost = more quota consumed.
 * Set in index.ts via setEndpointCost().
 *
 * Cost mapping:
 *   1 = read operation (cheap)
 *   2-5 = moderate reads (analytics, search)
 *   5-10 = writes (contributions, payouts)
 *   10 = sensitive (deposits, KYC, ramp)
 */

export const MUTATION_ENDPOINT_COSTS = {
  // Auth (10 req/15min regardless of tier)
  '/api/auth/challenge': { cost: 1, type: 'public' },
  '/api/auth/verify': { cost: 1, type: 'public' },
  '/api/auth/refresh': { cost: 1, type: 'public' },
  '/api/auth/logout': { cost: 1, type: 'public' },
  '/api/auth/logout-everywhere': { cost: 1, type: 'auth' },

  // KYC (sensitive, 10 cost)
  '/api/kyc/submit': { cost: 10, type: 'sensitive' },
  '/api/kyc/status': { cost: 2, type: 'read' },

  // Ramp (sensitive, 10 cost)
  '/api/ramp/deposit': { cost: 10, type: 'sensitive' },
  '/api/ramp/withdraw': { cost: 10, type: 'sensitive' },
  '/api/ramp/:id/status': { cost: 5, type: 'read' },

  // SEP-31 (cross-border, sensitive)
  '/api/sep31/transactions': { cost: 8, type: 'write' },
  '/api/sep31/transactions/:id': { cost: 2, type: 'read' },

  // Webhooks
  '/api/webhooks': { cost: 5, type: 'write' },
  '/api/webhooks/:id': { cost: 2, type: 'write' },

  // Groups (write-heavy)
  '/api/v1/groups': { cost: 5, type: 'write' },
  '/api/v1/groups/:id/join': { cost: 3, type: 'write' },
  '/api/v1/groups/:id/leave': { cost: 3, type: 'write' },

  // Contributions
  '/api/v1/contributions': { cost: 5, type: 'write' },
  '/api/v1/contributions/:id': { cost: 2, type: 'write' },
} as const;
