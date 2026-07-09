// ============================================
// Redis Client — Caching layer for geo-location data
// Provides LRU cache with gzip compression and TTL management
// ============================================

import { createClient } from 'redis';
import { promisify } from 'util';
import zlib from 'zlib';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// ==========================================
// Global client instance (singleton pattern)
// WHY singleton: Reuse connection pool across requests
// ==========================================
type AppRedisClient = ReturnType<typeof createClient>;

let redisClient: AppRedisClient | null = null;
let connectionPromise: Promise<AppRedisClient> | null = null;

/**
 * Get or create Redis client instance.
 *
 * WHY singleton + connection promise: Prevents multiple concurrent
 * connection attempts during cold start. All requests share one pool.
 *
 * @returns Connected Redis client
 * @throws {Error} If connection fails after retries
 */
export async function getRedisClient(): Promise<AppRedisClient> {
  if (redisClient?.isOpen) return redisClient;

  // WHY promise guard: If connection is in progress, wait for it
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    console.info('[Redis] Establishing connection...');

    const client = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        reconnectStrategy: (retries) => {
          console.warn('[Redis] Reconnecting...', { attempt: retries });
          // Exponential backoff: 50ms, 100ms, 200ms, ... max 2s
          return Math.min(retries * 50, 2000);
        },
      },
    });

    client.on('error', (err) => console.error('[Redis] Error:', err));
    client.on('connect', () => console.info('[Redis] Connected'));
    client.on('reconnecting', () => console.warn('[Redis] Reconnecting...'));
    client.on('ready', () => console.info('[Redis] Ready'));

    await client.connect();
    redisClient = client;
    connectionPromise = null;
    return client;
  })();

  return connectionPromise;
}

/**
 * Check if Redis is available.
 *
 * @returns true if connected, false otherwise
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    await client.ping();
    return true;
  } catch (error: unknown) {
    console.warn('[Redis] Not available:', error);
    return false;
  }
}

// ==========================================
// Cache TTL Constants
// ==========================================
export const CACHE_TTL = {
  /** Marker lists — refresh every 5min to reflect new uploads */
  MARKERS: 5 * 60,
  /** File details — longer TTL since metadata rarely changes */
  FILE_DETAILS: 30 * 60,
  /** Stats — expensive aggregation, cache for 1 hour */
  STATS: 60 * 60,
  /** Spatial queries — moderate TTL for dynamic bbox queries */
  SPATIAL: 10 * 60,
  /** Thumbnails — very stable, cache for 1 day */
  THUMBNAILS: 24 * 60 * 60,
} as const;

// ==========================================
// Cache Helper with Gzip Compression
// ==========================================

export const cache = {
  /**
   * Get cached value with automatic decompression.
   *
   * WHY gzip: Reduces Redis memory usage by ~70% for JSON data.
   * Trade-off: +5-10ms CPU time vs -70% memory per key.
   *
   * @param key - Cache key
   * @returns Parsed value or null if not found/expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const client = await getRedisClient();
      const compressed = await client.get(key);
      if (!compressed) return null;

      // WHY Buffer: Redis stores as base64 string, decompress to JSON
      const buffer = Buffer.from(compressed, 'base64');
      const json = await gunzip(buffer);
      const value = JSON.parse(json.toString('utf-8')) as T;

      console.info('[Cache] HIT:', { key, size: buffer.length });
      return value;
    } catch (error: unknown) {
      console.error('[Cache] Get failed:', { key, error });
      return null;
    }
  },

  /**
   * Set cached value with automatic compression.
   *
   * @param key - Cache key
   * @param value - Value to cache (will be JSON.stringify'd)
   * @param ttlSeconds - Time-to-live in seconds
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    try {
      const client = await getRedisClient();
      const json = JSON.stringify(value);
      const compressed = await gzip(json);
      const base64 = compressed.toString('base64');

      await client.setEx(key, ttlSeconds, base64);

      const compressionRatio = ((1 - compressed.length / json.length) * 100).toFixed(1);
      console.info('[Cache] SET:', {
        key,
        ttl: ttlSeconds,
        originalSize: json.length,
        compressedSize: compressed.length,
        compressionRatio: `${compressionRatio}%`,
      });
    } catch (error: unknown) {
      console.error('[Cache] Set failed:', { key, error });
    }
  },

  /**
   * Delete cache key(s) by pattern.
   *
   * WHY pattern support: Allows invalidating entire categories like 'geo:markers:*'.
   *
   * @param pattern - Redis key pattern (supports * wildcard)
   * @example
   * ```ts
   * await cache.del('geo:markers:*');  // Delete all marker caches
   * await cache.del('geo:file:abc123'); // Delete specific file
   * ```
   */
  async del(pattern: string): Promise<number> {
    try {
      const client = await getRedisClient();

      // WHY SCAN instead of KEYS: KEYS blocks Redis, SCAN is non-blocking
      const keys: string[] = [];
      for await (const key of client.scanIterator({ MATCH: pattern })) {
        // WHY flat: scanIterator may yield individual strings or arrays of strings
        // depending on the redis client version — flatten to ensure consistent string[]
        if (Array.isArray(key)) {
          keys.push(...key);
        } else {
          keys.push(key as string);
        }
      }

      if (keys.length === 0) {
        console.info('[Cache] DEL: no keys matched', { pattern });
        return 0;
      }

      const deleted = await client.del(keys);
      console.info('[Cache] DEL:', { pattern, deleted });
      return deleted;
    } catch (error: unknown) {
      console.error('[Cache] Delete failed:', { pattern, error });
      return 0;
    }
  },

  /**
   * Check if key exists in cache.
   *
   * @param key - Cache key
   * @returns true if exists, false otherwise
   */
  async exists(key: string): Promise<boolean> {
    try {
      const client = await getRedisClient();
      const result = await client.exists(key);
      return result === 1;
    } catch (error: unknown) {
      console.error('[Cache] Exists check failed:', { key, error });
      return false;
    }
  },

  /**
   * Get TTL (remaining time-to-live) for a key.
   *
   * @param key - Cache key
   * @returns TTL in seconds, or -1 if key doesn't exist, -2 if no TTL set
   */
  async ttl(key: string): Promise<number> {
    try {
      const client = await getRedisClient();
      return await client.ttl(key);
    } catch (error: unknown) {
      console.error('[Cache] TTL check failed:', { key, error });
      return -1;
    }
  },

  /**
   * Get cache statistics.
   *
   * @returns Redis INFO stats
   */
  async stats() {
    try {
      const client = await getRedisClient();
      const info = await client.info();
      return info;
    } catch (error: unknown) {
      console.error('[Cache] Stats failed:', error);
      return null;
    }
  },
};

// ==========================================
// Cache Key Generation
// ==========================================

/**
 * Generate deterministic cache key from object.
 *
 * WHY hash: Filter objects can be large (camera names, tag lists).
 * MD5 is fast and collision-resistant enough for cache keys.
 *
 * @param prefix - Key namespace (e.g., 'geo:markers')
 * @param data - Object to hash (will be JSON.stringify'd in sorted order)
 * @param suffix - Optional suffix (e.g., page number)
 * @returns Cache key string
 *
 * @example
 * ```ts
 * generateCacheKey('geo:markers', { camera: 'Canon', hasGps: true }, 'p1')
 * // → 'geo:markers:a3f2d1b4:p1'
 * ```
 */
export function generateCacheKey(
  prefix: string,
  data: Record<string, unknown>,
  suffix?: string
): string {
  // WHY sorted stringify: { a: 1, b: 2 } and { b: 2, a: 1 } should produce same key
  const sortedData = Object.keys(data)
    .sort()
    .reduce((acc, key) => {
      acc[key] = data[key];
      return acc;
    }, {} as Record<string, unknown>);

  const dataStr = JSON.stringify(sortedData);

  // WHY MD5: Fast, deterministic, 12-char hash is enough to avoid collisions
  const crypto = require('crypto');
  const hash = crypto.createHash('md5').update(dataStr).digest('hex').slice(0, 12);

  const parts = [prefix, hash];
  if (suffix) parts.push(suffix);

  return parts.join(':');
}

/**
 * Invalidate all geo-related caches.
 *
 * WHY separate function: Common operation when new files are uploaded
 * or when admin wants to force refresh.
 *
 * @param scope - 'all' | 'markers' | 'stats' | 'files' | specific key
 */
export async function invalidateGeoCache(
  scope: 'all' | 'markers' | 'stats' | 'files' | string
): Promise<void> {
  console.info('[Cache] Invalidating geo cache:', { scope });

  switch (scope) {
    case 'all':
      await cache.del('geo:*');
      break;
    case 'markers':
      await cache.del('geo:markers:*');
      break;
    case 'stats':
      await cache.del('geo:stats:*');
      break;
    case 'files':
      await cache.del('geo:file:*');
      break;
    default:
      // Specific key
      await cache.del(scope);
  }

  console.info('[Cache] Invalidation complete:', { scope });
}

// ==========================================
// Graceful Shutdown
// ==========================================

/**
 * Close Redis connection gracefully.
 *
 * WHY needed: Prevents "Connection closed unexpectedly" errors on shutdown.
 */
export async function closeRedisClient(): Promise<void> {
  if (redisClient?.isOpen) {
    console.info('[Redis] Closing connection...');
    await redisClient.quit();
    redisClient = null;
    console.info('[Redis] Connection closed');
  }
}

// Register cleanup handler
if (typeof process !== 'undefined') {
  process.on('SIGTERM', closeRedisClient);
  process.on('SIGINT', closeRedisClient);
}
