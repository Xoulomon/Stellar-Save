/**
 * CacheService - TTL-aware caching with localStorage + in-memory fallback.
 * Supports get/set/delete/invalidate/clear with automatic expiry checks.
 */

interface CacheEntry {
  data: unknown;
  expiry: number; // timestamp ms
}

export interface CacheOptions {
  prefix?: string;
  memoryOnly?: boolean;
}

export class CacheService<T = unknown> {
  private prefix: string;
  private memoryOnly: boolean;
  private memoryCache: Map<string, CacheEntry> = new Map();

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix ?? 'ss-cache_';
    this.memoryOnly = options.memoryOnly ?? false;
    this._loadFromStorage();
  }

  private getKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.expiry;
  }

  private _loadFromStorage(): void {
    if (this.memoryOnly) return;

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith(this.prefix)) {
          const value = localStorage.getItem(key);
          if (value) {
            try {
              const entry: CacheEntry = JSON.parse(value);
              if (!this.isExpired(entry)) {
                this.memoryCache.set(key, entry);
              } else {
                localStorage.removeItem(key);
              }
            } catch {
              localStorage.removeItem(key);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Cache load failed, using memory-only:', e);
      this.memoryOnly = true;
    }
  }

  private _saveToStorage(key: string, entry: CacheEntry): void {
    if (this.memoryOnly) return;

    try {
      localStorage.setItem(key, JSON.stringify(entry));
    } catch (e) {
      console.warn('Storage save failed:', e);
      this.memoryOnly = true;
    }
  }

  set(key: string, value: T, ttlMs: number = 5 * 60 * 1000): void { // default 5min
    const fullKey = this.getKey(key);
    const entry: CacheEntry = {
      data: value,
      expiry: Date.now() + ttlMs,
    };

    this.memoryCache.set(fullKey, entry);
    this._saveToStorage(fullKey, entry);
  }

  get(key: string): T | null {
    const fullKey = this.getKey(key);
    const entry = this.memoryCache.get(fullKey);

    if (!entry || this.isExpired(entry)) {
      this.delete(key);
      return null;
    }

    return entry.data as T;
  }

  delete(key: string): void {
    const fullKey = this.getKey(key);
    this.memoryCache.delete(fullKey);
    if (!this.memoryOnly) {
      localStorage.removeItem(fullKey);
    }
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  invalidate(pattern?: string): void {
    const prefix = this.prefix;
    const targetPrefix = pattern ? `${prefix}${pattern}_` : prefix;

    // Memory
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(targetPrefix) || (pattern && key.includes(pattern))) {
        this.memoryCache.delete(key);
      }
    }

    // Storage
    if (!this.memoryOnly) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)!;
        if (key.startsWith(targetPrefix) || (pattern && key.includes(pattern))) {
          localStorage.removeItem(key);
        }
      }
    }
  }

  clear(): void {
    this.memoryCache.clear();
    if (!this.memoryOnly) {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)!;
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      }
    }
  }
}

// Default instance for convenience
export const cache = new CacheService();

