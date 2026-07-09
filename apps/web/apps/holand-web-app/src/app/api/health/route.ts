// ============================================
// API Route: /api/health — Health check for backend services
// Checks MongoDB and Redis connectivity
// ============================================

import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { getRedisClient } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * GET /api/health — Health check endpoint.
 *
 * @endpoint GET /api/health
 * @returns Health status for MongoDB and Redis
 *
 * @example
 * ```bash
 * curl http://localhost:3001/api/health
 * ```
 */
export async function GET() {
  console.info('[API/health] Health check request');
  
  const checks = await Promise.allSettled([
    (async () => {
      if (!process.env.MONGODB_URI) {
        return { mongodb: 'skipped', reason: 'MONGODB_URI not set (geo uses map_explorer tools)' };
      }
      try {
        const db = await getDatabase();
        await db.command({ ping: 1 });
        return { mongodb: 'ok', timestamp: new Date().toISOString() };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Connection failed';
        throw new Error(`MongoDB: ${msg}`);
      }
    })(),
    
    // Redis check
    (async () => {
      try {
        const client = await getRedisClient();
        await client.ping();
        return { redis: 'ok', timestamp: new Date().toISOString() };
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : 'Connection failed';
        throw new Error(`Redis: ${msg}`);
      }
    })(),
  ]);
  
  const results = checks.map((c) => 
    c.status === 'fulfilled' ? c.value : { error: c.reason.message }
  );
  
  const allHealthy = checks.every(
    (c) => c.status === 'fulfilled' && !('error' in (c.value as object))
  );
  
  return NextResponse.json(
    {
      status: allHealthy ? 'healthy' : 'degraded',
      checks: results,
      timestamp: new Date().toISOString(),
    },
    { status: allHealthy ? 200 : 503 }
  );
}
