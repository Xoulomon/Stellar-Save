/**
 * Cache warming job for preloading frequently accessed data.
 *
 * Periodically loads cache with commonly accessed endpoints to reduce
 * initial cache misses and improve user experience.
 */

import { CACHE_TTL_SECONDS } from './lib/cache-config';
import { CacheKeyBuilder } from './lib/cache-key-builder';
import { logger } from './lib/logger';
import { set } from './redis';

const warmData = {
  '/api/retirements': [
    { id: 1, amount: 100, entity: 'Company A' },
    { id: 2, amount: 250, entity: 'Company B' },
  ],
  '/api/stats': { totalRetired: 350, totalTransactions: 2 },
};

let warmingInterval: ReturnType<typeof setInterval> | null = null;

const warmAllEndpoints = async (): Promise<void> => {
  for (const [endpoint, data] of Object.entries(warmData)) {
    const cacheKey = CacheKeyBuilder.cacheWarming(endpoint);
    await set(cacheKey, data, CACHE_TTL_SECONDS.CACHE_WARMING_DEFAULT);
    logger.info('Cache warmed endpoint', { endpoint });
  }
};

export const startWarmingJob = async (): Promise<void> => {
  logger.info('Starting cache warming job');

  await warmAllEndpoints();

  logger.info('Cache warming completed');

  if (warmingInterval !== null) {
    clearInterval(warmingInterval);
  }

  warmingInterval = setInterval(async () => {
    logger.debug('Running scheduled cache warming');
    try {
      await warmAllEndpoints();
    } catch (error) {
      logger.error('Scheduled cache warming failed', { error });
    }
  }, CACHE_TTL_SECONDS.CACHE_WARMING_DEFAULT * 1000);
};

export const stopWarmingJob = (): void => {
  if (warmingInterval !== null) {
    clearInterval(warmingInterval);
    warmingInterval = null;
    logger.info('Cache warming job stopped');
  }
};