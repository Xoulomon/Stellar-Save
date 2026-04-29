import { Request, Response, NextFunction } from 'express';
import { createRateLimiterMiddleware, RateLimiterOptions } from './rate_limiter';
import * as redis from './redis';

/**
 * Middleware for caching analytics GET requests
 */
export function createAnalyticsCacheMiddleware(ttlSeconds: number = 3600) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `http_cache:${req.originalUrl || req.url}`;

    try {
      // Try to get from cache
      const cachedResponse = await redis.get(cacheKey);
      if (cachedResponse) {
        res.setHeader('X-Cache', 'HIT');
        return res.json(cachedResponse);
      }

      // Store original res.json to intercept response
      const originalJson = res.json.bind(res);

      res.json = (data: any) => {
        // Cache the response
        redis.set(cacheKey, data, ttlSeconds).catch((err) => {
          console.error('Error caching analytics response:', err);
        });

        res.setHeader('X-Cache', 'MISS');
        return originalJson(data);
      };

      next();
    } catch (error) {
      console.error('Error in analytics cache middleware:', error);
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
  const cacheMiddleware = createAnalyticsCacheMiddleware(3600); // 1 hour cache
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
    console.error('Error invalidating analytics cache:', error);
  }
}

/**
 * Invalidate specific analytic cache entries by date
 */
export async function invalidateAnalyticsCacheByDate(date: Date) {
  const dateStr = date.toISOString().split('T')[0];
  const patterns = [
    `http_cache:*/analytics/platform*date=${dateStr}*`,
    `http_cache:*/analytics/users/*date=${dateStr}*`,
    `http_cache:*/analytics/groups/*date=${dateStr}*`,
  ];

  for (const pattern of patterns) {
    try {
      await redis.delPattern(pattern);
    } catch (error) {
      console.error(`Error invalidating cache pattern ${pattern}:`, error);
    }
  }
}
