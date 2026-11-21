import Redis from 'ioredis';

import { config } from './config';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

let hits = 0;
let misses = 0;

export const recordHit = () => {
  hits++;
};
export const recordMiss = () => {
  misses++;
};

export const getCacheStats = async () => {
  return {
    hits,
    misses,
    hitRate: hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0,
    connected: redis.status === 'ready',
  };
};

export const get = async <T = unknown>(key: string): Promise<T | null> => {
  const data = await redis.get(key);
  if (data) {
    recordHit();
    return JSON.parse(data) as T;
  }
  recordMiss();
  return null;
};

export const set = async (key: string, value: unknown, ttlSeconds: number = 3600) => {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
};

export const del = async (key: string) => {
  await redis.del(key);
};

export const delPattern = async (pattern: string) => {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) {
    await redis.del(...keys);
  }
};

export const readinessCheckCache = async (): Promise<{
  up: boolean;
  latencyMs: number;
  error?: string;
}> => {
  const start = Date.now();
  try {
    await redis.ping();
    return { up: true, latencyMs: Date.now() - start };
  } catch (err: unknown) {
    return {
      up: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
};

export default redis;
