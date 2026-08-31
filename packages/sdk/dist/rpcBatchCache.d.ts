/**
 * Intelligent request batching and tiered caching for Soroban RPC calls.
 * Reduces round-trips and improves read latency.
 */
interface CacheStats {
    hits: number;
    misses: number;
    hitRate: number;
}
declare class TieredCache {
    private readonly l1;
    private readonly l2;
    private stats;
    get<T>(key: string): T | undefined;
    set<T>(key: string, value: T, ttlMs: number, tier?: "l1" | "l2"): void;
    getStats(): CacheStats;
    evictExpired(): void;
}
declare class RequestBatcher<TKey, TResult> {
    private readonly batchFn;
    private readonly maxBatchSize;
    private readonly delayMs;
    private queue;
    private timer;
    constructor(batchFn: (keys: TKey[]) => Promise<Map<TKey, TResult>>, maxBatchSize?: number, delayMs?: number);
    enqueue(key: TKey): Promise<TResult>;
    private flush;
}
export declare const cache: TieredCache;
export declare function getCachedLedgerEntry(key: string, fetchFn: () => Promise<unknown>): Promise<unknown>;
export declare function getCachedContractData(contractId: string, dataKey: string, fetchFn: () => Promise<unknown>): Promise<unknown>;
export declare const accountBatcher: RequestBatcher<string, unknown>;
export declare function getCacheStats(): CacheStats;
export {};
//# sourceMappingURL=rpcBatchCache.d.ts.map