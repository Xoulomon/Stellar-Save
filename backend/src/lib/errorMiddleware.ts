import { randomUUID } from 'crypto';

import { statusCodeOf, toEnvelope } from './errors';
import { attachCorrelationId, getCorrelationId } from './requestContext';

import type { Request, Response, NextFunction } from 'express';

const CORRELATION_HEADER = 'x-correlation-id';
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Resolves the correlation ID for the current request.
 *
 * Prefers the ID already established in the consolidated request context
 * (set by the request-context middleware). Only when no context exists do we
 * generate a fresh ID, and in that case we attach it so downstream consumers
 * observe the same value.
 */
function resolveCorrelationId(req: Request, res: Response): string {
  const existing = getCorrelationId(req) || attachCorrelationId(req, res);
  if (existing) {
    return existing;
  }
  const generated = randomUUID();
  attachCorrelationId(req, res, generated);
  return generated;
}

function applyCorrelationHeaders(res: Response, correlationId: string): void {
  res.setHeader(CORRELATION_HEADER, correlationId);
  res.setHeader(REQUEST_ID_HEADER, correlationId);
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = resolveCorrelationId(req, res);
  applyCorrelationHeaders(res, correlationId);
  const envelope = toEnvelope(err, correlationId);
  const statusCode = statusCodeOf(err);
  res.status(statusCode).json({ error: envelope });
}

export function notFoundMiddleware(req: Request, res: Response): void {
  const correlationId = resolveCorrelationId(req, res);
  applyCorrelationHeaders(res, correlationId);
  res.status(404).json({
    error: errorEnvelope(
      {
        code: 'NOT_FOUND',
        message: `Route ${req.method} ${req.path} not found`,
      },
      correlationId
    ),
  });
}