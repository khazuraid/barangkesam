import Redis from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});

redis.on('connect', () => console.log('✅ Redis connected'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

// ─── Cache helpers ────────────────────────────────────────────────────────────

export async function getCache<T>(key: string): Promise<T | null> {
  const data = await redis.get(key);
  if (!data) return null;
  return JSON.parse(data) as T;
}

export async function setCache(key: string, value: unknown, ttlSeconds = 300): Promise<void> {
  await redis.setex(key, ttlSeconds, JSON.stringify(value));
}

export async function delCache(...keys: string[]): Promise<void> {
  if (keys.length > 0) await redis.del(...keys);
}

export async function delCachePattern(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern);
  if (keys.length > 0) await redis.del(...keys);
}

// ─── Cache keys ───────────────────────────────────────────────────────────────

export const CacheKeys = {
  dashboardStats: () => 'dashboard:stats',
  dashboardChart: () => 'dashboard:chart',
  alkesGroups: () => 'groups:alkes',
  alkesDetail: (id: string) => `alkes:${id}`,
  alkesImages: (id: string) => `alkes:${id}:images`,
  alkesList: () => 'alkes:list',
  alkesRusak: () => 'alkes:rusak',
};
