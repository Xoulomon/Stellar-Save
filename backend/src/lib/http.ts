import { getCorrelationId } from './requestContext';

type HeadersInitLike = HeadersInit | Record<string, string>;

function toHeaders(init?: HeadersInitLike): Headers {
  return new Headers(init ?? {});
}

export function withCorrelationHeaders(initHeaders?: HeadersInitLike): Headers {
  const headers = toHeaders(initHeaders);
  const correlationId = getCorrelationId();
  if (correlationId && !headers.has('x-correlation-id')) {
    headers.set('x-correlation-id', correlationId);
  }
  return headers;
}

export async function fetchWithCorrelationId(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: withCorrelationHeaders(init.headers),
  });
}
