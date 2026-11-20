import { randomUUID } from 'crypto';

import { statusCodeOf } from './errors';
import { errorEnvelope } from './response-envelope';
import { attachCorrelationId } from './requestContext';

import type { Request, Response, NextFunction } from 'express';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = attachCorrelationId(req, res) || randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  const envelope = errorEnvelope(err, correlationId);
  const statusCode = statusCodeOf(err);
  res.status(statusCode).json({ error: envelope });
}

export function notFoundMiddleware(req: Request, res: Response): void {
  const correlationId = attachCorrelationId(req, res) || randomUUID();
  res.setHeader('x-correlation-id', correlationId);
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