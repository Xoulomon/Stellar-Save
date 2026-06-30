import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { AppError, toEnvelope } from './errors';

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  const envelope = toEnvelope(err, correlationId);
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  res.status(statusCode).json({ error: envelope });
}

export function notFoundMiddleware(req: Request, res: Response): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || randomUUID();
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      correlationId,
      timestamp: new Date().toISOString(),
    },
  });
}
