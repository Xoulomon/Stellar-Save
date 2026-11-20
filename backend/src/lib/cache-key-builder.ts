/**
 * Centralized cache key builder utility.
 *
 * Provides domain-specific methods for constructing cache keys consistently
 * across the application. This eliminates key-naming duplication and makes
 * it easier to refactor cache key patterns without changing call sites.
 */

import { CACHE_KEY_PREFIXES, CACHE_KEY_SEPARATOR } from './cache-config';

export class CacheKeyBuilder {
  /**
   * Build a cache key from components using the standard separator.
   * @param components Array of key parts to join
   * @returns Joined cache key
   */
  private static buildKey(...components: (string | number)[]): string {
    return components.join(CACHE_KEY_SEPARATOR);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HTTP / Analytics endpoints
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a cache key for HTTP response caching (analytics or general endpoints).
   * @param url The request URL or path
   * @returns Cache key for the HTTP response
   */
  static httpResponse(url: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.HTTP_CACHE, url);
  }

  /**
   * Build a cache key for platform-wide analytics statistics.
   * @param date ISO date string (YYYY-MM-DD)
   * @returns Cache key for platform stats
   */
  static analyticsPlatformStats(date: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.ANALYTICS, 'platform_stats', date);
  }

  /**
   * Build a cache key for user-specific analytics statistics.
   * @param userId The user's ID
   * @param date ISO date string (YYYY-MM-DD)
   * @returns Cache key for user stats
   */
  static analyticsUserStats(userId: string, date: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.ANALYTICS, 'user_stats', userId, date);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Group State (contract/group management)
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a cache key for group state.
   * @param contractId The contract ID
   * @param groupId The group ID
   * @returns Cache key for group state
   */
  static groupState(contractId: string, groupId: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.GROUP_STATE, contractId, groupId);
  }

  /**
   * Build a pattern for invalidating all group states under a contract.
   * @param contractId The contract ID
   * @returns Pattern string for delPattern matching
   */
  static groupStatePattern(contractId: string): string {
    return `${this.buildKey(CACHE_KEY_PREFIXES.GROUP_STATE, contractId)}${CACHE_KEY_SEPARATOR}*`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // IPFS Metadata
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a cache key for IPFS group metadata CID (content identifier).
   * @param contractId The contract ID
   * @param groupId The group ID
   * @returns Cache key for IPFS CID
   */
  static ipfsGroupCid(contractId: string, groupId: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.IPFS_GROUP_CID, contractId, groupId);
  }

  /**
   * Build a cache key for cached IPFS group metadata (the actual metadata payload).
   * @param contractId The contract ID
   * @param groupId The group ID
   * @returns Cache key for IPFS metadata cache
   */
  static ipfsGroupMetadata(contractId: string, groupId: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.IPFS_GROUP_METADATA, contractId, groupId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Cache Warming
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a cache key for cache warming jobs.
   * @param endpoint The endpoint or identifier being warmed
   * @returns Cache key for the warming data
   */
  static cacheWarming(endpoint: string): string {
    return this.buildKey(CACHE_KEY_PREFIXES.CACHE_WARMING, endpoint);
  }

  /**
   * Build a pattern for invalidating all cache warming entries.
   * @returns Pattern string for delPattern matching
   */
  static cacheWarmingPattern(): string {
    return `${CACHE_KEY_PREFIXES.CACHE_WARMING}${CACHE_KEY_SEPARATOR}*`;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Generic helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Build a pattern for invalidating all HTTP response cache entries.
   * @returns Pattern string for delPattern matching
   */
  static httpResponsePattern(): string {
    return `${CACHE_KEY_PREFIXES.HTTP_CACHE}${CACHE_KEY_SEPARATOR}*`;
  }

  /**
   * Build a pattern for invalidating all analytics cache entries.
   * @returns Pattern string for delPattern matching
   */
  static analyticsPattern(): string {
    return `${CACHE_KEY_PREFIXES.ANALYTICS}${CACHE_KEY_SEPARATOR}*`;
  }
}
