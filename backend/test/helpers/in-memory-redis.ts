/**
 * In-memory Redis double for integration tests.
 *
 * Implements the subset of the ioredis API surface used by the IPFS pinning
 * modules (src/ipfs/pinning_queue.ts, src/ipfs/pinning_service.ts):
 *   - get / set / setex / del / incr / expire
 *   - hset / hget / hgetall / keys
 *   - zadd / zpopmin / zcard
 *   - sadd / srem / scard
 *   - multi() -> fluent chain returning { exec }
 *
 * This lets integration tests exercise the real PinningService / PinningQueue
 * retry and pin lifecycle logic without a live Redis instance.
 */

export interface MultiCommand {
  op: string;
  args: unknown[];
}

class InMemoryMulti {
  private commands: MultiCommand[] = [];
  private redis: InMemoryRedis;

  constructor(redis: InMemoryRedis) {
    this.redis = redis;
  }

  private push(op: string, ...args: unknown[]): this {
    this.commands.push({ op, args });
    return this;
  }

  hset(...args: unknown[]): this {
    return this.push('hset', ...args);
  }

  zadd(...args: unknown[]): this {
    return this.push('zadd', ...args);
  }

  sadd(...args: unknown[]): this {
    return this.push('sadd', ...args);
  }

  srem(...args: unknown[]): this {
    return this.push('srem', ...args);
  }

  del(...args: unknown[]): this {
    return this.push('del', ...args);
  }

  async exec(): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const cmd of this.commands) {
      switch (cmd.op) {
        case 'hset':
          this.redis.hset(cmd.args[0] as string, cmd.args[1] as Record<string, string>);
          results.push(1);
          break;
        case 'zadd':
          this.redis.zadd(
            cmd.args[0] as string,
            cmd.args[1] as number,
            cmd.args[2] as string,
          );
          results.push(1);
          break;
        case 'sadd':
          this.redis.sadd(cmd.args[0] as string, ...(cmd.args.slice(1) as string[]));
          results.push(1);
          break;
        case 'srem':
          this.redis.srem(cmd.args[0] as string, ...(cmd.args.slice(1) as string[]));
          results.push(1);
          break;
        case 'del':
          this.redis.del(...(cmd.args as string[]));
          results.push(1);
          break;
      }
    }
    return results;
  }
}

export class InMemoryRedis {
  private store = new Map<string, string>();
  private hashes = new Map<string, Map<string, string>>();
  private zsets = new Map<string, Map<string, number>>();
  private sets = new Map<string, Set<string>>();
  private counters = new Map<string, number>();

  reset(): void {
    this.store.clear();
    this.hashes.clear();
    this.zsets.clear();
    this.sets.clear();
    this.counters.clear();
  }

  multi(): InMemoryMulti {
    return new InMemoryMulti(this);
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: unknown): Promise<string> {
    this.store.set(key, String(value));
    return 'OK';
  }

  async setex(key: string, _ttl: number, value: unknown): Promise<string> {
    this.store.set(key, String(value));
    return 'OK';
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      const removed =
        this.store.delete(key) ||
        this.hashes.delete(key) ||
        this.zsets.delete(key) ||
        this.sets.delete(key);
      if (removed) count++;
    }
    return count;
  }

  async incr(key: string): Promise<number> {
    const next = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, next);
    this.store.set(key, String(next));
    return next;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }

  async hset(
    key: string,
    fieldOrObject: string | Record<string, string>,
    value?: string,
  ): Promise<number> {
    const hash = this.hashes.get(key) ?? new Map<string, string>();
    if (typeof fieldOrObject === 'object' && fieldOrObject !== null) {
      for (const [k, v] of Object.entries(fieldOrObject)) hash.set(k, v);
    } else {
      hash.set(fieldOrObject, value ?? '');
    }
    this.hashes.set(key, hash);
    return 1;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const hash = this.hashes.get(key);
    if (!hash) return {};
    return Object.fromEntries(hash.entries());
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    const all = new Set<string>([
      ...this.store.keys(),
      ...this.hashes.keys(),
      ...this.zsets.keys(),
      ...this.sets.keys(),
    ]);
    return Array.from(all).filter((k) => regex.test(k));
  }

  async zadd(key: string, priority: number, member: string): Promise<number> {
    const zset = this.zsets.get(key) ?? new Map<string, number>();
    zset.set(member, priority);
    this.zsets.set(key, zset);
    return 1;
  }

  async zpopmin(key: string, count = 1): Promise<string[]> {
    const zset = this.zsets.get(key);
    if (!zset || zset.size === 0) return [];
    const sorted = Array.from(zset.entries()).sort((a, b) => a[1] - b[1]);
    const results = sorted.slice(0, count).map(([member]) => member);
    for (const member of results) zset.delete(member);
    return results;
  }

  async zcard(key: string): Promise<number> {
    return this.zsets.get(key)?.size ?? 0;
  }

  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>();
    for (const member of members) set.add(member);
    this.sets.set(key, set);
    return members.length;
  }

  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key);
    if (!set) return 0;
    let count = 0;
    for (const member of members) {
      if (set.delete(member)) count++;
    }
    return count;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }
}
