import { verifyJwt } from './auth_service';
import { config } from '../../config';
import { ForbiddenError, UnauthorizedError } from '../../lib/errors';

import type { AppError } from '../../lib/errors';
import type { Request, Response, NextFunction } from 'express';

/** Responds using the status code mapped from the error type. */
const sendError = (res: Response, err: AppError) =>
  res.status(err.statusCode).json({ error: err.message });

// ── Admin auth (existing) ─────────────────────────────────────────────────────

const ADMIN_SECRET = config.admin.secret;

export interface AuthenticatedRequest extends Request {
  adminId?: string;
  walletAddress?: string; // set by jwtAuthMiddleware
}

export const adminAuthMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const secret = req.headers['x-admin-secret'];

  if (secret === ADMIN_SECRET) {
    req.adminId = 'admin_001';
    next();
  } else {
    sendError(res, new UnauthorizedError('Unauthorized: Invalid Admin Secret'));
  }
};

// ── JWT user auth ─────────────────────────────────────────────────────────────

/**
 * Protects routes that require a wallet-verified user session.
 *
 * Expects:  Authorization: Bearer <jwt>
 *
 * On success, attaches `req.walletAddress` (the JWT `sub` claim) and calls next().
 * On failure, responds 401.
 */
export const jwtAuthMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(
      res,
      new UnauthorizedError('Unauthorized: Missing or malformed Authorization header')
    );
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const payload = verifyJwt(token);
    req.walletAddress = payload.sub;
    next();
  } catch (err: unknown) {
    const isExpired = err instanceof Error && err.name === 'TokenExpiredError';
    return sendError(
      res,
      new UnauthorizedError(
        isExpired ? 'Unauthorized: Token expired' : 'Unauthorized: Invalid token'
      )
    );
  }
};

/**
 * Enforces that the authenticated wallet can only access their own data.
 * Use after jwtAuthMiddleware on routes with a :walletAddress or :userId param.
 *
 * Usage: router.get('/user/:walletAddress/...', jwtAuthMiddleware, requireSelf, handler)
 */
export const requireSelf = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const paramAddress = req.params.walletAddress || req.params.userId;

  if (!paramAddress || req.walletAddress !== paramAddress) {
    return sendError(res, new ForbiddenError('Forbidden: You can only access your own data'));
  }

  next();
};
