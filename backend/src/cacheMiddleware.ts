import Redis from 'ioredis';
import { config } from './config';

const redis = new Redis({
  host: config.redis.host,
  port: config.redis.port,
  password: config.redis.password,
});

let hits = 0;
let misses = 0;

export const recordHit = () => { hits++; };
export const recordMiss = () => { misses++; };

export const getCacheStats = async () => {
  return {
    hits,
    misses,
    hitRate: hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0,
    connected: redis.status === 'ready',
  };
};

export const get = async (key: string): Promise<any | null> => {
  const data = await redis.get(key);
  if (data) {
    recordHit();
    return JSON.parse(data);
  }
  recordMiss();
  return null;
};

export const set = async (key: string, value: any, ttlSeconds: number = 3600) => {
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

export default redis;
