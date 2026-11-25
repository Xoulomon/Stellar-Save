import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import type { Request, Response } from 'express';

export interface RequestContext {
  correlationId?: string;
  requestId?: string;
  traceId?: string;
  spanId?: string;
  method?: string;
  path?: string;
}

const requestContext = new AsyncLocalStorage<RequestContext>();

export function createCorrelationId(): string {
  return randomUUID();
}

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  const correlationId = context.correlationId ?? context.requestId ?? createCorrelationId();
  return requestContext.run(
    {
      ...context,
      correlationId,
      requestId: context.requestId ?? correlationId,
    },
    callback
  );
}

export function getRequestContext(): RequestContext | undefined {
  return requestContext.getStore();
}

export function getCorrelationId(): string | undefined {
  const context = getRequestContext();
  return context?.correlationId ?? context?.requestId;
}

export function getRequestCorrelationId(req?: Request): string | undefined {
  return (
    (req?.headers['x-correlation-id'] as string | undefined) ||
    (req?.headers['x-request-id'] as string | undefined) ||
    (req?.res?.getHeader('x-correlation-id') as string | undefined) ||
    getCorrelationId()
  );
}

export function attachCorrelationId(req: Request, res: Response): string {
  const correlationId = getRequestCorrelationId(req) || createCorrelationId();
  res.setHeader('x-correlation-id', correlationId);
  return correlationId;
}

export function getPropagationHeaders(
  context: RequestContext | undefined = getRequestContext()
): Record<string, string> {
  if (!context) return {};
  const headers: Record<string, string> = {};
  const requestId = context.requestId ?? context.correlationId;
  const traceId = context.traceId ?? context.correlationId;

  if (requestId) headers['x-request-id'] = requestId;
  if (traceId) headers['x-trace-id'] = traceId;
  if (context.spanId) headers['x-span-id'] = context.spanId;
  return headers;
}
