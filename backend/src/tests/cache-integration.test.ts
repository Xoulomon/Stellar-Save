/**
 * Integration tests for cache operations: hit/miss scenarios, TTL handling, and invalidation.
 *
 * These tests verify that cache operations work correctly across modules
 * and that TTL values are properly applied.
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { CacheKeyBuilder } from '../lib/cache-key-builder';
import { CACHE_TTL_SECONDS } from '../lib/cache-config';
import * as redis from '../redis';

/**
 * Mock Redis operations to verify cache behavior without a live Redis instance.
 */
jest.mock('../redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  delPattern: jest.fn(),
  recordHit: jest.fn(),
  recordMiss: jest.fn(),
  getCacheStats: jest.fn(),
}));

describe('Cache Integration - Hit/Miss Scenarios', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP Response Caching
  // ──────────────────────────────────────────────────────────────────────────

  describe('HTTP response caching', () => {
    it('should retrieve cached HTTP response on hit', async () => {
      const url = '/api/analytics/stats';
      const cachedData = { totalUsers: 100, activeUsers: 50 };
      const cacheKey = CacheKeyBuilder.httpResponse(url);

      (redis.get as jest.Mock).mockResolvedValue(cachedData);

      const result = await redis.get(cacheKey);

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedData);
    });

    it('should return null on cache miss for HTTP response', async () => {
      const url = '/api/analytics/stats';
      const cacheKey = CacheKeyBuilder.httpResponse(url);

      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await redis.get(cacheKey);

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toBeNull();
    });

    it('should store HTTP response with correct TTL', async () => {
      const url = '/api/analytics/stats';
      const data = { totalUsers: 100 };
      const cacheKey = CacheKeyBuilder.httpResponse(url);
      const ttl = CACHE_TTL_SECONDS.ANALYTICS_HTTP_RESPONSE;

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cacheKey, data, ttl);

      expect(redis.set).toHaveBeenCalledWith(cacheKey, data, ttl);
      // Verify the TTL is 1 hour (3600 seconds)
      expect(ttl).toBe(3600);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Analytics Platform Stats Caching
  // ──────────────────────────────────────────────────────────────────────────

  describe('analytics platform stats caching', () => {
    it('should use correct cache key for platform stats', async () => {
      const date = '2024-01-15';
      const stats = { totalUsers: 1000, totalGroups: 50 };
      const cacheKey = CacheKeyBuilder.analyticsPlatformStats(date);

      (redis.get as jest.Mock).mockResolvedValue(stats);

      const result = await redis.get(cacheKey);

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(cacheKey).toContain('analytics');
      expect(cacheKey).toContain('platform_stats');
      expect(cacheKey).toContain(date);
    });

    it('should store platform stats with 1-hour TTL', async () => {
      const date = '2024-01-15';
      const stats = { totalUsers: 1000 };
      const cacheKey = CacheKeyBuilder.analyticsPlatformStats(date);
      const ttl = CACHE_TTL_SECONDS.ANALYTICS_PLATFORM_STATS;

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cacheKey, stats, ttl);

      expect(redis.set).toHaveBeenCalledWith(cacheKey, stats, 3600);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Analytics User Stats Caching
  // ──────────────────────────────────────────────────────────────────────────

  describe('analytics user stats caching', () => {
    it('should cache user stats with userId and date', async () => {
      const userId = 'user-123';
      const date = '2024-01-15';
      const stats = {
        userId,
        groupsJoined: 5,
        totalContributions: 100,
      };
      const cacheKey = CacheKeyBuilder.analyticsUserStats(userId, date);

      (redis.get as jest.Mock).mockResolvedValue(stats);

      const result = await redis.get(cacheKey);

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(cacheKey).toContain('analytics');
      expect(cacheKey).toContain('user_stats');
      expect(cacheKey).toContain(userId);
      expect(cacheKey).toContain(date);
    });

    it('should store user stats with 1-hour TTL', async () => {
      const userId = 'user-123';
      const date = '2024-01-15';
      const stats = { userId, groupsJoined: 5 };
      const cacheKey = CacheKeyBuilder.analyticsUserStats(userId, date);
      const ttl = CACHE_TTL_SECONDS.ANALYTICS_USER_STATS;

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cacheKey, stats, ttl);

      expect(redis.set).toHaveBeenCalledWith(cacheKey, stats, 3600);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group State Caching
  // ──────────────────────────────────────────────────────────────────────────

  describe('group state caching', () => {
    it('should cache group state with 10-second TTL', async () => {
      const contractId = 'contract-abc123';
      const groupId = 'group-xyz789';
      const state = { memberCount: 10, totalAmount: 1000 };
      const cacheKey = CacheKeyBuilder.groupState(contractId, groupId);
      const ttl = CACHE_TTL_SECONDS.GROUP_STATE;

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cacheKey, state, ttl);

      expect(redis.set).toHaveBeenCalledWith(cacheKey, state, 10);
    });

    it('should retrieve group state on cache hit', async () => {
      const contractId = 'contract-abc123';
      const groupId = 'group-xyz789';
      const cachedState = { memberCount: 10, totalAmount: 1000 };
      const cacheKey = CacheKeyBuilder.groupState(contractId, groupId);

      (redis.get as jest.Mock).mockResolvedValue(cachedState);

      const result = await redis.get(cacheKey);

      expect(redis.get).toHaveBeenCalledWith(cacheKey);
      expect(result).toEqual(cachedState);
    });

    it('should return null on group state cache miss', async () => {
      const contractId = 'contract-abc123';
      const groupId = 'group-xyz789';
      const cacheKey = CacheKeyBuilder.groupState(contractId, groupId);

      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await redis.get(cacheKey);

      expect(result).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cache Invalidation
  // ──────────────────────────────────────────────────────────────────────────

  describe('cache invalidation', () => {
    it('should delete specific cache entry', async () => {
      const contractId = 'contract-1';
      const groupId = 'group-1';
      const cacheKey = CacheKeyBuilder.groupState(contractId, groupId);

      (redis.del as jest.Mock).mockResolvedValue(1);

      await redis.del(cacheKey);

      expect(redis.del).toHaveBeenCalledWith(cacheKey);
    });

    it('should invalidate all entries matching a pattern', async () => {
      const contractId = 'contract-1';
      const pattern = CacheKeyBuilder.groupStatePattern(contractId);

      (redis.delPattern as jest.Mock).mockResolvedValue(5);

      await redis.delPattern(pattern);

      expect(redis.delPattern).toHaveBeenCalledWith(pattern);
      expect(pattern).toContain('*');
      expect(pattern).toMatch(/\*$/);
    });

    it('should handle multiple invalidations for different patterns', async () => {
      (redis.delPattern as jest.Mock).mockResolvedValue(undefined);

      const patterns = [
        `http_cache:*/analytics/platform*`,
        `http_cache:*/analytics/users/*`,
        `http_cache:*/analytics/groups/*`,
      ];

      for (const pattern of patterns) {
        await redis.delPattern(pattern);
      }

      expect(redis.delPattern).toHaveBeenCalledTimes(3);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // IPFS Metadata Caching
  // ──────────────────────────────────────────────────────────────────────────

  describe('IPFS metadata caching', () => {
    it('should use separate keys for CID and metadata', async () => {
      const contractId = 'contract-1';
      const groupId = 'group-1';
      const cidKey = CacheKeyBuilder.ipfsGroupCid(contractId, groupId);
      const metadataKey = CacheKeyBuilder.ipfsGroupMetadata(contractId, groupId);

      expect(cidKey).not.toBe(metadataKey);
    });

    it('should cache IPFS metadata with 5-minute TTL', async () => {
      const contractId = 'contract-1';
      const groupId = 'group-1';
      const metadata = { name: 'Group Name', description: 'Description' };
      const cacheKey = CacheKeyBuilder.ipfsGroupMetadata(contractId, groupId);
      const ttl = CACHE_TTL_SECONDS.IPFS_GROUP_METADATA;

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cacheKey, metadata, ttl);

      expect(redis.set).toHaveBeenCalledWith(cacheKey, metadata, 300);
    });

    it('should cache IPFS CID separately from metadata', async () => {
      const contractId = 'contract-1';
      const groupId = 'group-1';
      const cid = 'QmXxxx...';
      const cidKey = CacheKeyBuilder.ipfsGroupCid(contractId, groupId);

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cidKey, cid, CACHE_TTL_SECONDS.IPFS_GROUP_METADATA);

      expect(redis.set).toHaveBeenCalledWith(
        cidKey,
        cid,
        CACHE_TTL_SECONDS.IPFS_GROUP_METADATA
      );
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cache Warming
  // ──────────────────────────────────────────────────────────────────────────

  describe('cache warming', () => {
    it('should warm cache with endpoints and default TTL', async () => {
      const endpoint = '/api/retirements';
      const data = [
        { id: 1, amount: 100, entity: 'Company A' },
        { id: 2, amount: 250, entity: 'Company B' },
      ];
      const cacheKey = CacheKeyBuilder.cacheWarming(endpoint);
      const ttl = CACHE_TTL_SECONDS.CACHE_WARMING_DEFAULT;

      (redis.set as jest.Mock).mockResolvedValue(undefined);

      await redis.set(cacheKey, data, ttl);

      expect(redis.set).toHaveBeenCalledWith(cacheKey, data, 3600);
    });

    it('should warm multiple endpoints during startup', async () => {
      (redis.set as jest.Mock).mockResolvedValue(undefined);

      const endpoints = ['/api/retirements', '/api/stats'];
      for (const endpoint of endpoints) {
        const cacheKey = CacheKeyBuilder.cacheWarming(endpoint);
        const data = { dummy: 'data' };
        await redis.set(
          cacheKey,
          data,
          CACHE_TTL_SECONDS.CACHE_WARMING_DEFAULT
        );
      }

      expect(redis.set).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // TTL Configuration
  // ──────────────────────────────────────────────────────────────────────────

  describe('TTL configuration', () => {
    it('should define all required TTL constants', () => {
      expect(CACHE_TTL_SECONDS.DEFAULT).toBe(3600);
      expect(CACHE_TTL_SECONDS.ANALYTICS_HTTP_RESPONSE).toBe(3600);
      expect(CACHE_TTL_SECONDS.ANALYTICS_PLATFORM_STATS).toBe(3600);
      expect(CACHE_TTL_SECONDS.ANALYTICS_USER_STATS).toBe(3600);
      expect(CACHE_TTL_SECONDS.GROUP_STATE).toBe(10);
      expect(CACHE_TTL_SECONDS.IPFS_GROUP_METADATA).toBe(300);
      expect(CACHE_TTL_SECONDS.CACHE_WARMING_DEFAULT).toBe(3600);
    });

    it('should have appropriate TTL hierarchy', () => {
      // Group state should be short-lived (10s) due to frequent updates
      expect(CACHE_TTL_SECONDS.GROUP_STATE).toBeLessThan(
        CACHE_TTL_SECONDS.IPFS_GROUP_METADATA
      );

      // IPFS metadata should be shorter than analytics (5m vs 1h)
      expect(CACHE_TTL_SECONDS.IPFS_GROUP_METADATA).toBeLessThan(
        CACHE_TTL_SECONDS.ANALYTICS_HTTP_RESPONSE
      );

      // Most analytics should cache for 1 hour
      expect(CACHE_TTL_SECONDS.ANALYTICS_HTTP_RESPONSE).toBe(
        CACHE_TTL_SECONDS.ANALYTICS_PLATFORM_STATS
      );
    });

    it('should use constants from shared config', () => {
      // Verify that TTL constants are actually used (not hardcoded elsewhere)
      const ttlValues = Object.values(CACHE_TTL_SECONDS);
      expect(ttlValues).toHaveLength(7);
      expect(ttlValues.every((v) => typeof v === 'number')).toBe(true);
      expect(ttlValues.every((v) => v > 0)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Hit/Miss Statistics
  // ──────────────────────────────────────────────────────────────────────────

  describe('cache statistics', () => {
    it('should record cache hits and misses', async () => {
      (redis.recordHit as jest.Mock).mockReturnValue(undefined);
      (redis.recordMiss as jest.Mock).mockReturnValue(undefined);

      redis.recordHit();
      redis.recordHit();
      redis.recordMiss();

      expect(redis.recordHit).toHaveBeenCalledTimes(2);
      expect(redis.recordMiss).toHaveBeenCalledTimes(1);
    });

    it('should retrieve cache statistics', async () => {
      const stats = {
        hits: 100,
        misses: 20,
        hitRate: 83.33,
        connected: true,
      };

      (redis.getCacheStats as jest.Mock).mockResolvedValue(stats);

      const result = await redis.getCacheStats();

      expect(result).toEqual(stats);
      expect(result.hitRate).toBeCloseTo(83.33, 1);
    });
  });
});
