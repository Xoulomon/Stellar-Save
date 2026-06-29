/**
 * Intelligent request batching and tiered caching for Soroban RPC calls.
 * Reduces round-trips and improves read latency.
 */
// ---------- Tiered in-memory cache ----------
class TieredCache {
    l1 = new Map(); // hot
    l2 = new Map(); // warm
    stats = { hits: 0, misses: 0 };
    get(key) {
        const now = Date.now();
        for (const tier of [this.l1, this.l2]) {
            const entry = tier.get(key);
            if (entry) {
                if (entry.expiresAt > now) {
                    this.stats.hits++;
                    this.l1.set(key, entry); // promote to L1
                    return entry.value;
                }
                tier.delete(key);
            }
        }
        this.stats.misses++;
        return undefined;
    }
    set(key, value, ttlMs, tier = "l1") {
        const store = tier === "l1" ? this.l1 : this.l2;
        store.set(key, { value, expiresAt: Date.now() + ttlMs });
    }
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        return { ...this.stats, hitRate: total ? this.stats.hits / total : 0 };
    }
    evictExpired() {
        const now = Date.now();
        for (const tier of [this.l1, this.l2]) {
            for (const [k, v] of tier) {
                if (v.expiresAt <= now)
                    tier.delete(k);
            }
        }
    }
}
// ---------- Request batcher ----------
class RequestBatcher {
    batchFn;
    maxBatchSize;
    delayMs;
    queue = [];
    timer = null;
    constructor(batchFn, maxBatchSize = 20, delayMs = 10) {
        this.batchFn = batchFn;
        this.maxBatchSize = maxBatchSize;
        this.delayMs = delayMs;
    }
    enqueue(key) {
        return new Promise((resolve, reject) => {
            this.queue.push({ key, resolve, reject });
            if (this.queue.length >= this.maxBatchSize) {
                this.flush();
            }
            else if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), this.delayMs);
            }
        });
    }
    flush() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const batch = this.queue.splice(0);
        if (batch.length === 0)
            return;
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
const CACHE_TTL = { ledgerEntry: 5_000, accountInfo: 10_000, contractData: 30_000 };
export const cache = new TieredCache();
let _stats = { hits: 0, misses: 0, hitRate: 0 };
export async function getCachedLedgerEntry(key, fetchFn) {
    const cached = cache.get(key);
    if (cached !== undefined)
        return cached;
    const value = await fetchFn();
    cache.set(key, value, CACHE_TTL.ledgerEntry);
    _stats = cache.getStats();
    return value;
}
export async function getCachedContractData(contractId, dataKey, fetchFn) {
    const cacheKey = `contract:${contractId}:${dataKey}`;
    const cached = cache.get(cacheKey);
    if (cached !== undefined)
        return cached;
    const value = await fetchFn();
    cache.set(cacheKey, value, CACHE_TTL.contractData, "l2");
    _stats = cache.getStats();
    return value;
}
export const accountBatcher = new RequestBatcher(async (addresses) => {
    // Real impl: bulk-fetch accounts from Horizon
    const results = new Map();
    await Promise.all(addresses.map(async (addr) => {
        results.set(addr, { address: addr, fetched: true });
    }));
    return results;
}, 20, 10);
export function getCacheStats() {
    return cache.getStats();
}
// Periodic eviction of stale entries
setInterval(() => cache.evictExpired(), 60_000);
