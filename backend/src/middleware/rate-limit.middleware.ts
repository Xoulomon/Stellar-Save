import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createRateLimiterMiddleware, createAuthRateLimiterMiddleware } from '../rate_limiter';

/**
 * Global rate limiting middleware for general endpoints.
 * - Unauthenticated traffic: per-IP limits (default: 100 req / 15 min).
 * - Authenticated traffic with user id: per-user limits (bypasses IP bucket).
 */
@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private middleware = createRateLimiterMiddleware();

  use(req: Request, res: Response, next: NextFunction) {
    this.middleware(req, res, next);
  }
}

/**
 * Strict rate limiting for authentication and admin endpoints.
 * - 10 requests per 15 minutes per IP, regardless of auth state.
 * - Applied to login, token verification, and admin operations.
 */
@Injectable()
export class AuthRateLimitMiddleware implements NestMiddleware {
  private middleware = createAuthRateLimiterMiddleware();

  use(req: Request, res: Response, next: NextFunction) {
    this.middleware(req, res, next);
  }
}
