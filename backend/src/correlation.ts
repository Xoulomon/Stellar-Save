/**
 * Correlation ID middleware + AsyncLocalStorage context.
 *
 * Every inbound HTTP request gets a correlation ID (from the
 * X-Correlation-ID header or auto-generated).  The ID is stored in
 * AsyncLocalStorage so any service called downstream — indexer, notification
 * service, backup jobs — can read it without threading it through every
 * function signature.
 *
 * Usage:
 *   import { correlationMiddleware, getCorrelationId } from './correlation';
 *   app.use(correlationMiddleware);
 *   logger.info('msg', { correlationId: getCorrelationId() });
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

interface CorrelationContext {
  correlationId: string;
  /** Originating service name when the ID was forwarded from another service */
  sourceService?: string;
}

const storage = new AsyncLocalStorage<CorrelationContext>();

/** Read the current correlation ID (undefined outside a request context). */
export function getCorrelationId(): string | undefined {
  return storage.getStore()?.correlationId;
}

/** Read the full context (useful for service-to-service propagation). */
export function getCorrelationContext(): CorrelationContext | undefined {
  return storage.getStore();
}

/**
 * Run a callback within a new correlation context.
 * Use this for background jobs that originate outside an HTTP request.
 */
export function runWithCorrelationId<T>(id: string, fn: () => T): T {
  return storage.run({ correlationId: id }, fn);
}

/**
 * Express middleware.
 * - Reads X-Correlation-ID from incoming request (trusts internal hops).
 * - Generates a new UUID v4 if absent.
 * - Echos the ID back in the response header.
 * - Wraps the rest of the chain in an AsyncLocalStorage context.
 */
export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[CORRELATION_HEADER];
  const correlationId =
    typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

  res.setHeader(CORRELATION_HEADER, correlationId);

  storage.run({ correlationId }, next);
}

/**
 * Build the propagation headers to forward when calling downstream services.
 * Pass these to fetch / axios / etc.
 */
export function propagationHeaders(): Record<string, string> {
  const id = getCorrelationId();
  return id ? { [CORRELATION_HEADER]: id } : {};
}
