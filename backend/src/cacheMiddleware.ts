/**
 * Cache middleware for Express applications.
 *
 * This module is a thin facade over the shared cache modules:
 *  - Core cache operations are delegated to `./redis`.
 *  - HTTP response caching is implemented here and builds keys
 *    exclusively via `CacheKeyBuilder.httpResponse(url)` from
 *    `./lib/cache-key-builder`.
 *  - TTLs are sourced from `CACHE_TTL_SECONDS` in `./lib/cache-config`.
 *
 * No key construction or TTL literals should live in this file; use the
 * shared helpers so conventions stay consistent across the backend.
 */

import type { Request, Response, NextFunction } from 'express';

import { get, set, recordHit, recordMiss } from './redis';
import { CacheKeyBuilder } from './lib/cache-key-builder';
import { CACHE_TTL_SECONDS } from './lib/cache-config';

export { get, set, del, delPattern, recordHit, recordMiss, getCacheStats } from './redis';

/**
 * Options for {@link httpResponseCache}.
 */
export interface HttpResponseCacheOptions {
  /**
   * Override the default TTL (in seconds). When omitted, the value from
   * `CACHE_TTL_SECONDS` in `lib/cache-config` is used.
   */
  ttlSeconds?: number;
  /**
   * Only cache responses for these HTTP methods. Defaults to `['GET']`.
   */
  methods?: string[];
  /**
   * Optional predicate to skip caching for specific requests.
   */
  skip?: (req: Request) => boolean;
}

/**
 * Resolve the TTL (in seconds) for HTTP response caching.
 *
 * Falls back to `CACHE_TTL_SECONDS` from the shared cache config so TTL
 * conventions remain centralized.
 */
function resolveTtlSeconds(override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override;
  }
  return CACHE_TTL_SECONDS;
}

/**
 * Express middleware that caches HTTP responses.
 *
 * Cache keys are built exclusively via `CacheKeyBuilder.httpResponse(url)`
 * to keep key conventions consistent. On a cache hit, the stored body is
 * written directly and the request short-circuits. On a miss, the response
 * body is captured and stored with the configured TTL.
 */
export function httpResponseCache(options: HttpResponseCacheOptions = {}) {
  const methods = (options.methods ?? ['GET']).map((m) => m.toUpperCase());
  const ttlSeconds = resolveTtlSeconds(options.ttlSeconds);

  return async function cacheMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    if (!methods.includes(req.method.toUpperCase())) {
      next();
      return;
    }

    if (options.skip && options.skip(req)) {
      next();
      return;
    }

    const key = CacheKeyBuilder.httpResponse(req.originalUrl ?? req.url);

    try {
      const cached = await get(key);
      if (cached !== null && cached !== undefined) {
        recordHit();
        res.setHeader('X-Cache', 'HIT');
        res.send(cached);
        return;
      }
    } catch {
      // On cache read failure, fall through to the normal handler.
    }

    recordMiss();
    res.setHeader('X-Cache', 'MISS');

    const originalSend = res.send.bind(res);
    res.send = function patchedSend(body?: unknown): Response {
      // Only cache successful responses.
      if (res.statusCode >= 200 && res.statusCode < 300 && body !== undefined) {
        const payload =
          typeof body === 'string' || Buffer.isBuffer(body)
            ? body
            : JSON.stringify(body);
        // Fire-and-forget; failures must not break the response path.
        void Promise.resolve(set(key, payload, ttlSeconds)).catch(() => undefined);
      }
      return originalSend(body);
    } as Response['send'];

    next();
  };
}

export default httpResponseCache;