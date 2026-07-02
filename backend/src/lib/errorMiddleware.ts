import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppError, toEnvelope } from './errors';
import { attachCorrelationId } from './requestContext';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = attachCorrelationId(req, res) || randomUUID();
  res.setHeader('x-correlation-id', correlationId);
  const envelope = toEnvelope(err, correlationId);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json({ error: envelope });
}

export function notFoundMiddleware(req: Request, res: Response): void {
  const correlationId = attachCorrelationId(req, res) || randomUUID();
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
}
