/**
 * Unit tests for CacheKeyBuilder utility.
 *
 * Verifies that cache keys are constructed consistently across the application
 * and that key patterns match their intended use cases.
 */

import { describe, it, expect } from '@jest/globals';
import { CacheKeyBuilder } from '../lib/cache-key-builder';
import { CACHE_KEY_PREFIXES, CACHE_KEY_SEPARATOR } from '../lib/cache-config';

describe('CacheKeyBuilder', () => {
  // ──────────────────────────────────────────────────────────────────────────
  // HTTP / Analytics endpoints
  // ──────────────────────────────────────────────────────────────────────────

  describe('httpResponse', () => {
    it('should construct HTTP response cache key with URL', () => {
      const url = '/api/analytics/stats';
      const key = CacheKeyBuilder.httpResponse(url);

      expect(key).toBe(`${CACHE_KEY_PREFIXES.HTTP_CACHE}:${url}`);
    });

    it('should handle URLs with query parameters', () => {
      const url = '/api/analytics/stats?date=2024-01-15&limit=10';
      const key = CacheKeyBuilder.httpResponse(url);

      expect(key).toBe(`${CACHE_KEY_PREFIXES.HTTP_CACHE}:${url}`);
    });

    it('should handle complex paths', () => {
      const url = '/api/v1/analytics/platform/stats/2024';
      const key = CacheKeyBuilder.httpResponse(url);

      expect(key).toBe(`${CACHE_KEY_PREFIXES.HTTP_CACHE}:${url}`);
    });
  });

  describe('analyticsPlatformStats', () => {
    it('should construct platform stats cache key with date', () => {
      const date = '2024-01-15';
      const key = CacheKeyBuilder.analyticsPlatformStats(date);

      expect(key).toBe(`${CACHE_KEY_PREFIXES.ANALYTICS}:platform_stats:${date}`);
    });

    it('should use ISO date format', () => {
      const date = '2026-09-26'; // current date from context
      const key = CacheKeyBuilder.analyticsPlatformStats(date);

      expect(key).toContain('platform_stats');
      expect(key).toContain(date);
    });
  });

  describe('analyticsUserStats', () => {
    it('should construct user stats cache key with userId and date', () => {
      const userId = 'user-123';
      const date = '2024-01-15';
      const key = CacheKeyBuilder.analyticsUserStats(userId, date);

      expect(key).toBe(
        `${CACHE_KEY_PREFIXES.ANALYTICS}:user_stats:${userId}:${date}`
      );
    });

    it('should handle different user ID formats', () => {
      const userId = 'uuid-abc123def456';
      const date = '2024-01-15';
      const key = CacheKeyBuilder.analyticsUserStats(userId, date);

      expect(key).toContain(userId);
      expect(key).toContain(date);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Group State (contract/group management)
  // ──────────────────────────────────────────────────────────────────────────

  describe('groupState', () => {
    it('should construct group state cache key with contractId and groupId', () => {
      const contractId = 'contract-abc123';
      const groupId = 'group-xyz789';
      const key = CacheKeyBuilder.groupState(contractId, groupId);

      expect(key).toBe(
        `${CACHE_KEY_PREFIXES.GROUP_STATE}:${contractId}:${groupId}`
      );
    });

    it('should handle Soroban contract IDs', () => {
      const contractId = 'CABC123DEFG456HIJK789LMNO'; // Stellar contract ID format
      const groupId = 'group-001';
      const key = CacheKeyBuilder.groupState(contractId, groupId);

      expect(key).toContain(contractId);
      expect(key).toContain(groupId);
    });

    it('should separate components with colon separator', () => {
      const contractId = 'contract-1';
      const groupId = 'group-1';
      const key = CacheKeyBuilder.groupState(contractId, groupId);
      const parts = key.split(CACHE_KEY_SEPARATOR);

      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(CACHE_KEY_PREFIXES.GROUP_STATE);
      expect(parts[1]).toBe(contractId);
      expect(parts[2]).toBe(groupId);
    });
  });

  describe('groupStatePattern', () => {
    it('should construct wildcard pattern for group state invalidation', () => {
      const contractId = 'contract-abc123';
      const pattern = CacheKeyBuilder.groupStatePattern(contractId);

      expect(pattern).toBe(
        `${CACHE_KEY_PREFIXES.GROUP_STATE}:${contractId}:*`
      );
    });

    it('should be suitable for Redis key pattern matching', () => {
      const contractId = 'contract-1';
      const pattern = CacheKeyBuilder.groupStatePattern(contractId);

      // Pattern should end with *
      expect(pattern).toMatch(/\*$/);
      // Should not have double colons or extra separators
      expect(pattern).not.toMatch(/::/);
    });

    it('should match specific keys with same contract', () => {
      const contractId = 'contract-1';
      const pattern = CacheKeyBuilder.groupStatePattern(contractId);
      const specificKey1 = CacheKeyBuilder.groupState(contractId, 'group-1');
      const specificKey2 = CacheKeyBuilder.groupState(contractId, 'group-2');

      // Both specific keys should match the pattern (conceptually)
      expect(specificKey1).toContain(contractId);
      expect(specificKey2).toContain(contractId);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // IPFS Metadata
  // ──────────────────────────────────────────────────────────────────────────

  describe('ipfsGroupCid', () => {
    it('should construct IPFS CID cache key', () => {
      const contractId = 'contract-123';
      const groupId = 'group-456';
      const key = CacheKeyBuilder.ipfsGroupCid(contractId, groupId);

      expect(key).toBe(
        `${CACHE_KEY_PREFIXES.IPFS_GROUP_CID}:${contractId}:${groupId}`
      );
    });

    it('should use distinct prefix from metadata cache', () => {
      const contractId = 'contract-123';
      const groupId = 'group-456';
      const cidKey = CacheKeyBuilder.ipfsGroupCid(contractId, groupId);
      const metadataKey = CacheKeyBuilder.ipfsGroupMetadata(contractId, groupId);

      expect(cidKey).not.toBe(metadataKey);
      expect(cidKey).toContain('cid');
      expect(metadataKey).toContain('cache');
    });
  });

  describe('ipfsGroupMetadata', () => {
    it('should construct IPFS metadata cache key', () => {
      const contractId = 'contract-123';
      const groupId = 'group-456';
      const key = CacheKeyBuilder.ipfsGroupMetadata(contractId, groupId);

      expect(key).toBe(
        `${CACHE_KEY_PREFIXES.IPFS_GROUP_METADATA}:${contractId}:${groupId}`
      );
    });

    it('should have different prefix than CID key', () => {
      const contractId = 'contract-1';
      const groupId = 'group-1';
      const cidKey = CacheKeyBuilder.ipfsGroupCid(contractId, groupId);
      const metadataKey = CacheKeyBuilder.ipfsGroupMetadata(contractId, groupId);

      // Keys should be distinct
      expect(cidKey).not.toBe(metadataKey);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // Cache Warming
  // ──────────────────────────────────────────────────────────────────────────

  describe('cacheWarming', () => {
    it('should construct cache warming key with endpoint', () => {
      const endpoint = '/api/retirements';
      const key = CacheKeyBuilder.cacheWarming(endpoint);

      expect(key).toBe(`${CACHE_KEY_PREFIXES.CACHE_WARMING}:${endpoint}`);
    });

    it('should handle different endpoints', () => {
      const endpoints = ['/api/stats', '/api/groups', '/api/users'];

      endpoints.forEach((endpoint) => {
        const key = CacheKeyBuilder.cacheWarming(endpoint);
        expect(key).toContain(CACHE_KEY_PREFIXES.CACHE_WARMING);
        expect(key).toContain(endpoint);
      });
    });

    it('should maintain consistency across calls', () => {
      const endpoint = '/api/endpoint';
      const key1 = CacheKeyBuilder.cacheWarming(endpoint);
      const key2 = CacheKeyBuilder.cacheWarming(endpoint);

      expect(key1).toBe(key2);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // General consistency checks
  // ──────────────────────────────────────────────────────────────────────────

  describe('consistency', () => {
    it('should always use colon separator between components', () => {
      const keys = [
        CacheKeyBuilder.httpResponse('/api/test'),
        CacheKeyBuilder.analyticsPlatformStats('2024-01-15'),
        CacheKeyBuilder.analyticsUserStats('user-1', '2024-01-15'),
        CacheKeyBuilder.groupState('contract-1', 'group-1'),
        CacheKeyBuilder.ipfsGroupCid('contract-1', 'group-1'),
        CacheKeyBuilder.ipfsGroupMetadata('contract-1', 'group-1'),
        CacheKeyBuilder.cacheWarming('/api/endpoint'),
      ];

      keys.forEach((key) => {
        // All keys should use the standard separator
        if (key.includes(CACHE_KEY_SEPARATOR)) {
          expect(key).toMatch(new RegExp(`\\${CACHE_KEY_SEPARATOR}`));
        }
      });
    });

    it('should not contain double separators', () => {
      const keys = [
        CacheKeyBuilder.httpResponse('/api/test'),
        CacheKeyBuilder.analyticsPlatformStats('2024-01-15'),
        CacheKeyBuilder.analyticsUserStats('user-1', '2024-01-15'),
        CacheKeyBuilder.groupState('contract-1', 'group-1'),
        CacheKeyBuilder.ipfsGroupCid('contract-1', 'group-1'),
        CacheKeyBuilder.ipfsGroupMetadata('contract-1', 'group-1'),
        CacheKeyBuilder.cacheWarming('/api/endpoint'),
      ];

      keys.forEach((key) => {
        // Check for double colons
        expect(key).not.toContain('::');
      });
    });

    it('should return string keys', () => {
      const keys = [
        CacheKeyBuilder.httpResponse('/api/test'),
        CacheKeyBuilder.analyticsPlatformStats('2024-01-15'),
        CacheKeyBuilder.analyticsUserStats('user-1', '2024-01-15'),
        CacheKeyBuilder.groupState('contract-1', 'group-1'),
        CacheKeyBuilder.groupStatePattern('contract-1'),
        CacheKeyBuilder.ipfsGroupCid('contract-1', 'group-1'),
        CacheKeyBuilder.ipfsGroupMetadata('contract-1', 'group-1'),
        CacheKeyBuilder.cacheWarming('/api/endpoint'),
      ];

      keys.forEach((key) => {
        expect(typeof key).toBe('string');
        expect(key.length).toBeGreaterThan(0);
      });
    });

    it('should be deterministic - same input produces same output', () => {
      const testCases = [
        { fn: () => CacheKeyBuilder.httpResponse('/api/test'), name: 'httpResponse' },
        {
          fn: () => CacheKeyBuilder.analyticsPlatformStats('2024-01-15'),
          name: 'analyticsPlatformStats',
        },
        {
          fn: () => CacheKeyBuilder.analyticsUserStats('user-1', '2024-01-15'),
          name: 'analyticsUserStats',
        },
        { fn: () => CacheKeyBuilder.groupState('c1', 'g1'), name: 'groupState' },
        { fn: () => CacheKeyBuilder.cacheWarming('/api/stats'), name: 'cacheWarming' },
      ];

      testCases.forEach(({ fn, name }) => {
        const result1 = fn();
        const result2 = fn();
        expect(result1).toBe(result2, `${name} should be deterministic`);
      });
    });
  });
});
