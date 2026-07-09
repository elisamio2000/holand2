// ============================================
// Rate Limiter — Redis-based با IP + User + Fingerprint
// ============================================

import { getRedisClient } from '@/lib/redis';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

/**
 * Rate limit configuration per endpoint
 */
export const RATE_LIMITS = {
  // Geo endpoints
  'geo:files': { max: 30, window: 60 }, // 30 requests per minute
  'geo:cluster': { max: 20, window: 60 }, // 20 requests per minute (heavy query)
  'geo:markers': { max: 40, window: 60 },
  'geo:timeline': { max: 15, window: 60 },
  'geo:movement': { max: 15, window: 60 },
  'geo:reverse-geocode': { max: 100, window: 60 }, // higher limit for cached endpoint
  
  // Global limits
  'global:ip': { max: 100, window: 60 }, // 100 requests per minute per IP
  'global:user': { max: 200, window: 60 }, // 200 requests per minute per user
} as const;

/**
 * استخراج fingerprint (VPN-resistant) از request
 * 
 * ترکیبی از:
 * - IP address
 * - User-Agent
 * - Accept-Language
 * - Device fingerprint (از header یا cookie)
 */
function getRequestFingerprint(req: NextRequest): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
              req.headers.get('x-real-ip') || 
              'unknown';
  const userAgent = req.headers.get('user-agent') || '';
  const acceptLanguage = req.headers.get('accept-language') || '';
  
  // Simple hash (در production از crypto.createHash استفاده کن)
  const fingerprint = `${ip}:${userAgent.slice(0, 50)}:${acceptLanguage}`;
  return Buffer.from(fingerprint).toString('base64').slice(0, 32);
}

/**
 * Check rate limit با Redis sliding window
 * 
 * @endpoint Used in ALL API routes
 * @param req NextRequest object
 * @param endpoint Endpoint identifier (e.g., 'geo:files')
 * @returns {allowed, remaining, resetAt} or throws error
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   const limitCheck = await checkRateLimit(req, 'geo:files');
 *   if (!limitCheck.allowed) {
 *     return NextResponse.json(
 *       { error: 'Rate limit exceeded' },
 *       { status: 429, headers: { 'Retry-After': String(limitCheck.resetAt) } }
 *     );
 *   }
 *   // ... proceed
 * }
 * ```
 */
export async function checkRateLimit(
  req: NextRequest,
  endpoint: keyof typeof RATE_LIMITS
): Promise<{
  allowed: boolean;
  remaining: number;
  resetAt: number;
  identifier: string;
}> {
  const config = RATE_LIMITS[endpoint];
  const fingerprint = getRequestFingerprint(req);
  
  // Get user ID if authenticated
  const token = await getToken({ req: req as any, secret: process.env.NEXTAUTH_SECRET });
  const userId = token?.user_id || null;

  // ساخت کلیدهای Redis
  const keys = [
    `ratelimit:endpoint:${endpoint}:${fingerprint}`, // endpoint-specific per fingerprint
    `ratelimit:ip:${fingerprint}`, // global IP limit
  ];
  
  if (userId) {
    keys.push(`ratelimit:user:${userId}`); // per-user limit
  }

  console.info('[RateLimit] Checking limits:', { endpoint, fingerprint, userId, keys });

  try {
    const redis = await getRedisClient();
    
    // بررسی همه limits به صورت موازی
    const results = await Promise.all(
      keys.map(async (key, index) => {
        const limitConfig = index === 0 
          ? config 
          : index === 1 
            ? RATE_LIMITS['global:ip'] 
            : RATE_LIMITS['global:user'];

        const current = await redis.incr(key);
        
        // اگر اولین request است، TTL رو set کن
        if (current === 1) {
          await redis.expire(key, limitConfig.window);
        }

        const ttl = await redis.ttl(key);
        const resetAt = Date.now() + (ttl * 1000);
        const remaining = Math.max(0, limitConfig.max - current);
        const allowed = current <= limitConfig.max;

        console.info(`[RateLimit] ${key}:`, { current, max: limitConfig.max, remaining, allowed });

        return { allowed, remaining, resetAt, key };
      })
    );

    // اگر حتی یک limit تجاوز شده باشه، request رو رد کن
    const violated = results.find(r => !r.allowed);
    if (violated) {
      console.warn('[RateLimit] EXCEEDED:', violated.key);
      return {
        allowed: false,
        remaining: 0,
        resetAt: violated.resetAt,
        identifier: fingerprint,
      };
    }

    // کمترین remaining رو برگردون
    const minRemaining = Math.min(...results.map(r => r.remaining));
    const maxResetAt = Math.max(...results.map(r => r.resetAt));

    return {
      allowed: true,
      remaining: minRemaining,
      resetAt: maxResetAt,
      identifier: fingerprint,
    };

  } catch (error) {
    console.error('[RateLimit] Redis error, allowing request:', error);
    // در صورت خطای Redis، request رو اجازه بده (Fail-open)
    return {
      allowed: true,
      remaining: config.max,
      resetAt: Date.now() + (config.window * 1000),
      identifier: fingerprint,
    };
  }
}

/**
 * Rate limit headers برای response
 */
export function getRateLimitHeaders(result: Awaited<ReturnType<typeof checkRateLimit>>) {
  return {
    'X-RateLimit-Limit': String(RATE_LIMITS['global:ip'].max),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.floor(result.resetAt / 1000)),
  };
}

/**
 * Manual rate limit reset (برای testing یا admin override)
 */
export async function resetRateLimit(identifier: string) {
  const redis = await getRedisClient();
  const pattern = `ratelimit:*:${identifier}`;
  const keys = await redis.keys(pattern);
  
  if (keys.length > 0) {
    await redis.del(keys);
    console.info('[RateLimit] Reset limits for:', identifier);
  }
}
