/**
 * Sentry integration for the Stellar-Save backend.
 *
 * Initialises Sentry once at startup.  Provides helpers for:
 *   - setting user / correlation context on every request
 *   - capturing errors (with correlation ID attached as a tag)
 *   - Express error-handler middleware
 *
 * Set SENTRY_DSN in the environment to enable.  When not set the module is a
 * safe no-op so local development and test runs are unaffected.
 */

import { Request, Response, NextFunction } from 'express';
import { getCorrelationId } from './correlation';
import { logger } from './logger';

// Lazy-load Sentry so a missing optional dep doesn't crash the process.
let Sentry: typeof import('@sentry/node') | null = null;
try {
  Sentry = require('@sentry/node');
} catch {
  // @sentry/node not installed — all functions become no-ops
}

export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || !Sentry) {
    logger.info('Sentry disabled — SENTRY_DSN not set');
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    integrations: [],
  });

  logger.info('Sentry initialised', { environment: process.env.NODE_ENV });
}

/** Attach correlation ID + wallet address to the current Sentry scope. */
export function setSentryContext(req: Request): void {
  if (!Sentry) return;
  const correlationId = getCorrelationId();
  Sentry.withScope(scope => {
    if (correlationId) scope.setTag('correlationId', correlationId);
    const wallet = (req.headers['authorization'] ?? '').toString().replace('Wallet ', '') ||
                   (req.query['wallet'] ?? '').toString() || undefined;
    if (wallet) scope.setUser({ id: wallet });
  });
}

/** Capture an error/exception and attach the current correlation ID. */
export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (!Sentry) return;
  Sentry.withScope(scope => {
    const cid = getCorrelationId();
    if (cid) scope.setTag('correlationId', cid);
    if (extra) scope.setExtras(extra);
    Sentry.captureException(err);
  });
}

/**
 * Express error-handler middleware — must be registered AFTER all routes.
 * Forwards unhandled errors to Sentry before passing them to the next handler.
 */
export function sentryErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  captureException(err, { path: req.path, method: req.method });
  next(err);
}
