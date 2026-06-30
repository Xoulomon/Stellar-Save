import { get, set, del, delPattern } from '../redis';
import { cacheHitsTotal, cacheMissesTotal, cacheInvalidationsTotal } from '../metrics';

const TTL_SECONDS = 10;
const KEY_PREFIX = 'group_state';

// Single-flight map: prevents cache stampede by coalescing concurrent fetches
// for the same key into a single in-flight promise.
const inFlight = new Map<string, Promise<unknown>>();

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

  /**
   * Single-flight loader: if a fetch for this key is already in progress,
   * coalesce callers onto that promise instead of thundering to the DB.
   */
  static async getOrLoad<T = unknown>(
    contractId: string,
    groupId: string,
    loader: () => Promise<T>
  ): Promise<T> {
    const key = cacheKey(contractId, groupId);

    const cached = await get(key);
    if (cached !== null) {
      cacheHitsTotal.inc({ cache: 'group_state' });
      return cached as T;
    }
    cacheMissesTotal.inc({ cache: 'group_state' });

    const existing = inFlight.get(key);
    if (existing) return existing as Promise<T>;

    const promise = loader().then(async (result) => {
      await set(key, result, TTL_SECONDS);
      inFlight.delete(key);
      return result;
    }).catch((err) => {
      inFlight.delete(key);
      throw err;
    });

    inFlight.set(key, promise);
    return promise as Promise<T>;
  }

  /** Store group state with a 10-second TTL. */
  static async set(contractId: string, groupId: string, state: unknown): Promise<void> {
    await set(cacheKey(contractId, groupId), state, TTL_SECONDS);
  }

  /** Invalidate a single group's cached state (called on relevant contract events). */
  static async invalidate(contractId: string, groupId: string, eventType = 'unknown'): Promise<void> {
    await del(cacheKey(contractId, groupId));
    cacheInvalidationsTotal.inc({ event_type: eventType });
  }

  /**
   * Invalidate all cached states for a contract.
   * Used when a contract event doesn't carry a specific groupId.
   */
  static async invalidateContract(contractId: string, eventType = 'unknown'): Promise<void> {
    await delPattern(`${KEY_PREFIX}:${contractId}:*`);
    cacheInvalidationsTotal.inc({ event_type: eventType });
  }
}

/**
 * Map a contract event type to the cache keys it must invalidate.
 * State-mutating events: contribution, payout, member_joined, group_created,
 * group_paused, group_unpaused, group_completed.
 */
const STATE_MUTATING_EVENTS = new Set([
  'contribution',
  'contribution_made',
  'contribute',
  'payout',
  'payout_received',
  'payoutreceived',
  'payout_processed',
  'member_joined',
  'memberjoined',
  'group_created',
  'groupcreated',
  'group_paused',
  'group_unpaused',
  'group_completed',
  'groupcompleted',
  'missed_contribution',
  'missedcontribution',
]);

export function isStateMutatingEvent(eventType: string): boolean {
  return STATE_MUTATING_EVENTS.has(eventType.toLowerCase().replace(/-/g, '_'));
}
