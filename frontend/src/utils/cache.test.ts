import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';\nimport { CacheService, type CacheOptions } from './cache';

describe('CacheService', () => {
  let cache: CacheService<string>;
  const KEY = 'test-key';
  const VALUE = 'test-value';
  const TTL_SHORT = 50; // ms for test expiry

  beforeEach(() => {
    cache = new CacheService({ prefix: 'test-' });
    // Clear localStorage prefix
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('test-')) localStorage.removeItem(key);
    });
    cache.clear();
  });

  afterEach(() => {
    cache.clear();
    vi.clearAllMocks();
  });

  it('should set and get value within TTL', () => {
    cache.set(KEY, VALUE, TTL_SHORT * 10);
    expect(cache.get(KEY)).toBe(VALUE);
    expect(cache.has(KEY)).toBe(true);
  });

  it('should expire value after TTL', async () => {
    cache.set(KEY, VALUE, TTL_SHORT);
    await new Promise(r => setTimeout(r, TTL_SHORT + 10));
    expect(cache.get(KEY)).toBeNull();
    expect(cache.has(KEY)).toBe(false);
  });

  it('should delete key', () => {
    cache.set(KEY, VALUE);
    cache.delete(KEY);
    expect(cache.get(KEY)).toBeNull();
  });

  it('should clear all', () => {
    cache.set(KEY, VALUE);
    cache.set('other', 'val');
    cache.clear();
    expect(cache.get(KEY)).toBeNull();
    expect(localStorage.getItem('test-' + KEY)).toBeNull();
  });

  it('should invalidate by pattern', () => {
    cache.set(KEY, VALUE);
    cache.set('other-key', 'val');
    cache.invalidate(KEY);
    expect(cache.get(KEY)).toBeNull();
    expect(cache.get('other-key')).toBe('val');
  });

  it('handles non-string/object values', () => {
    const numCache = new CacheService<number>();
    numCache.set('num', 42, 10000);
    expect(numCache.get('num')).toBe(42);
  });

  it('falls back to memory on storage error', () => {
    const mockLocalStorage = Object.keys(localStorage).reduce((acc, key) => {
      acc[key] = localStorage.getItem(key);
      return acc;
    }, {} as any);
    // Simulate quota exceeded
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const memCache = new CacheService({ prefix: 'memtest-' });
    memCache.set(KEY, VALUE);
    expect(memCache.get(KEY)).toBe(VALUE);
  });

  describe('memoryOnly option', () => {
    it('ignores localStorage', () => {
      const memOnly = new CacheService({ memoryOnly: true });
      memOnly.set(KEY, VALUE);
      expect(localStorage.getItem('ss-cache_' + KEY)).toBeNull();
    });
  });
});
