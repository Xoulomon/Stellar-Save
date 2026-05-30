import { get, set, del, delPattern } from '../redis';
import { cacheHitsTotal, cacheMissesTotal } from '../metrics';

const TTL_SECONDS = 10;
const KEY_PREFIX = 'group_state';

function cacheKey(contractId: string, groupId: string): string {
  return `${KEY_PREFIX}:${contractId}:${groupId}`;
}

export class GroupStateCache {
  /**
   * Return cached group state, or null on a cache miss.
   * Increments the appropriate Prometheus counter.
   */
  static async get<T = unknown>(contractId: string, groupId: string): Promise<T | null> {
    const value = await get(cacheKey(contractId, groupId));
    if (value !== null) {
      cacheHitsTotal.inc({ cache: 'group_state' });
      return value as T;
    }
    cacheMissesTotal.inc({ cache: 'group_state' });
    return null;
  }

  /** Store group state with a 10-second TTL. */
  static async set(contractId: string, groupId: string, state: unknown): Promise<void> {
    await set(cacheKey(contractId, groupId), state, TTL_SECONDS);
  }

  /** Invalidate a single group's cached state (called on relevant contract events). */
  static async invalidate(contractId: string, groupId: string): Promise<void> {
    await del(cacheKey(contractId, groupId));
  }

  /**
   * Invalidate all cached states for a contract.
   * Used when a contract event doesn't carry a specific groupId.
   */
  static async invalidateContract(contractId: string): Promise<void> {
    await delPattern(`${KEY_PREFIX}:${contractId}:*`);
  }
}
