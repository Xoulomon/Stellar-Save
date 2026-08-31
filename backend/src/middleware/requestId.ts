import type { Request, Response, NextFunction } from 'express';
import {
  attachCorrelationId,
  runWithRequestContext,
} from '../lib/requestContext';

/**
 * Request-id correlation middleware.
 *
 * - Reuses an inbound `x-correlation-id` header when present, otherwise
 *   generates a UUID.
 * - Echoes the id back on the response `x-correlation-id` header.
 * - Runs the remainder of the request inside an AsyncLocalStorage context so
 *   every `logger.*` call made while handling the request is automatically
 *   stamped with `correlation_id` (see `lib/logger.ts`).
 *
 * Mount this early — before `requestLogger` and route handlers.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const correlationId = attachCorrelationId(req, res);

  runWithRequestContext(
    {
      correlationId,
      method: req.method,
      path: req.path,
    },
    () => next(),
  );
}

export default requestId;
