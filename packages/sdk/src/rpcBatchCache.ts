/**
 * Intelligent request batching and tiered caching for Soroban RPC calls.
 * Reduces round-trips and improves read latency.
 */

// ---------- Types ----------

type Resolver<T> = { resolve: (v: T) => void; reject: (e: unknown) => void };

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
}

// ---------- Tiered in-memory cache ----------

class TieredCache {
  private readonly l1 = new Map<string, CacheEntry<unknown>>(); // hot
  private readonly l2 = new Map<string, CacheEntry<unknown>>(); // warm
  private stats = { hits: 0, misses: 0 };

  get<T>(key: string): T | undefined {
    const now = Date.now();
    for (const tier of [this.l1, this.l2]) {
      const entry = tier.get(key);
      if (entry) {
        if (entry.expiresAt > now) {
          this.stats.hits++;
          this.l1.set(key, entry); // promote to L1
          return entry.value as T;
        }
        tier.delete(key);
      }
    }
    this.stats.misses++;
    return undefined;
  }

  set<T>(key: string, value: T, ttlMs: number, tier: "l1" | "l2" = "l1"): void {
    const store = tier === "l1" ? this.l1 : this.l2;
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return { ...this.stats, hitRate: total ? this.stats.hits / total : 0 };
  }

  evictExpired(): void {
    const now = Date.now();
    for (const tier of [this.l1, this.l2]) {
      for (const [k, v] of tier) {
        if (v.expiresAt <= now) tier.delete(k);
      }
    }
  }
}

// ---------- Request batcher ----------

class RequestBatcher<TKey, TResult> {
  private queue: Array<{ key: TKey } & Resolver<TResult>> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly batchFn: (keys: TKey[]) => Promise<Map<TKey, TResult>>,
    private readonly maxBatchSize = 20,
    private readonly delayMs = 10,
  ) {}

  enqueue(key: TKey): Promise<TResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({ key, resolve, reject });
      if (this.queue.length >= this.maxBatchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.delayMs);
      }
    });
  }

  private flush(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const batch = this.queue.splice(0);
    if (batch.length === 0) return;

    const keys = batch.map((b) => b.key);
    this.batchFn(keys)
      .then((results) => {
        for (const item of batch) {
          const result = results.get(item.key);
          result !== undefined ? item.resolve(result) : item.reject(new Error(`No result for key: ${String(item.key)}`));
        }
      })
      .catch((err) => batch.forEach((item) => item.reject(err)));
  }
}

// ---------- Cached RPC client ----------

const CACHE_TTL = { ledgerEntry: 5_000, accountInfo: 10_000, contractData: 30_000 } as const;

export const cache = new TieredCache();
let _stats: CacheStats = { hits: 0, misses: 0, hitRate: 0 };

export async function getCachedLedgerEntry(key: string, fetchFn: () => Promise<unknown>): Promise<unknown> {
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const value = await fetchFn();
  cache.set(key, value, CACHE_TTL.ledgerEntry);
  _stats = cache.getStats();
  return value;
}

export async function getCachedContractData(contractId: string, dataKey: string, fetchFn: () => Promise<unknown>): Promise<unknown> {
  const cacheKey = `contract:${contractId}:${dataKey}`;
  const cached = cache.get(cacheKey);
  if (cached !== undefined) return cached;
  const value = await fetchFn();
  cache.set(cacheKey, value, CACHE_TTL.contractData, "l2");
  _stats = cache.getStats();
  return value;
}

export const accountBatcher = new RequestBatcher<string, unknown>(
  async (addresses) => {
    // Real impl: bulk-fetch accounts from Horizon
    const results = new Map<string, unknown>();
    await Promise.all(addresses.map(async (addr) => {
      results.set(addr, { address: addr, fetched: true });
    }));
    return results;
  },
  20,
  10,
);

export function getCacheStats(): CacheStats {
  return cache.getStats();
}

// Periodic eviction of stale entries
setInterval(() => cache.evictExpired(), 60_000);
