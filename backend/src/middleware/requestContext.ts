import type { NextFunction, Request, Response } from 'express';

import {
  correlationHeaders,
  getRequestContext,
  requestContextMiddleware as baseRequestContextMiddleware,
  runWithRequestContext,
  type RequestContext,
} from './requestId';

export type { RequestContext };
export { correlationHeaders, getRequestContext, runWithRequestContext };

/**
 * Express middleware that generates or accepts a request ID and trace context,
 * stores it in async context, and echoes the IDs back on the response.
 *
 * Thin wrapper over the consolidated implementation in `./requestId` so there
 * is a single source of truth for request-ID storage and generation.
 */
export function requestContextMiddleware(req: Request, res: Response, next: NextFunction): void {
  baseRequestContextMiddleware(req, res, next);
}

/**
 * Builds propagation headers for outgoing calls (Soroban RPC, Horizon, webhooks).
 */
export function buildPropagationHeaders(
  context: RequestContext | undefined = getRequestContext(),
): Record<string, string> {
  if (!context) return {};
  return {
    [correlationHeaders.requestId]: context.requestId,
    [correlationHeaders.traceId]: context.traceId,
    [correlationHeaders.spanId]: context.spanId,
  };
}
