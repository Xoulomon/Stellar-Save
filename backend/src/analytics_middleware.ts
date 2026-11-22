/**
 * Middleware for caching analytics GET requests
 */
import { logger } from './logger';
import { createRateLimiterMiddleware } from './rate_limiter';
import * as redis from './redis';
import { CacheKeyBuilder } from './lib/cache-key-builder';
import { CACHE_TTL_SECONDS } from './lib/cache-config';
import { invalidateAnalyticsCacheByDate as invalidateAnalyticsCacheByDateService } from './analytics_service';

import type { RateLimiterOptions } from './rate_limiter';
import type { Request, Response, NextFunction } from 'express';


export function createAnalyticsCacheMiddleware(ttlSeconds: number = CACHE_TTL_SECONDS.ANALYTICS_HTTP_RESPONSE) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = CacheKeyBuilder.httpResponse(req.originalUrl || req.url);

    try {
      // Try to get from cache
      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);

      res.json = (data: unknown) => {
        // Cache the response
        redis.set(cacheKey, data, ttlSeconds).catch((err) => {
          logger.error('Error caching analytics response:', err);
        });

        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      logger.error('Error in analytics cache middleware:', error);
      next();
    }
  };
}

/**
 * Rate limiter specifically for analytics endpoints
 * More lenient than default to allow data exploration
 */
export function createAnalyticsRateLimiter() {
  const options: RateLimiterOptions = {
    ipPolicy: {
      windowMs: 60 * 1000, // 1 minute
      max: 300, // 300 requests per minute for IPs
    },
    userPolicy: {
      windowMs: 60 * 1000, // 1 minute
      max: 600, // 600 requests per minute for authenticated users
    },
  };

  return createRateLimiterMiddleware(options);
}

/**
 * Rate limiter for write operations (POST requests)
 * More restrictive than read operations
 */
export function createAnalyticsWriteRateLimiter() {
  const options: RateLimiterOptions = {
    ipPolicy: {
      windowMs: 60 * 1000, // 1 minute
      max: 50, // 50 write requests per minute for IPs
    },
    userPolicy: {
      windowMs: 60 * 1000, // 1 minute
      max: 100, // 100 write requests per minute for authenticated users
    },
  };

  return createRateLimiterMiddleware(options);
}

/**
 * Middleware stack for analytics endpoints
 */
export function createAnalyticsMiddlewareStack() {
  const cacheMiddleware = createAnalyticsCacheMiddleware(CACHE_TTL_SECONDS.ANALYTICS_HTTP_RESPONSE);
  const readRateLimiter = createAnalyticsRateLimiter();
  const writeRateLimiter = createAnalyticsWriteRateLimiter();

  return {
    cache: cacheMiddleware,
    readRateLimit: readRateLimiter,
    writeRateLimit: writeRateLimiter,
  };
}

/**
 * Invalidate cache for analytics data
 */
export async function invalidateAnalyticsCache(pattern: string = 'http_cache:/analytics/*') {
  try {
    await redis.delPattern(pattern);
  } catch (error) {
    logger.error('Error invalidating analytics cache:', error);
  }
}

/**
 * Invalidate specific analytic cache entries by date.
 * Delegates to the consolidated implementation in analytics_service.ts
 * so cache-key patterns live in a single place.
 */
export async function invalidateAnalyticsCacheByDate(date: Date) {
  await invalidateAnalyticsCacheByDateService(date);
}
