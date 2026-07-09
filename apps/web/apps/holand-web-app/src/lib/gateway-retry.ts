// ============================================
// Gateway retry & rate-limit helpers (shared)
// ============================================

import { isAxiosError } from 'axios';
import { messengerQueue, shareTokenQueue, thumbnailQueue } from '@/utils/request-queue';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extract HTTP status from axios or gateway tool errors. */
export function getHttpStatus(err: unknown): number | undefined {
  if (isAxiosError(err)) return err.response?.status;
  if (err && typeof err === 'object' && 'statusCode' in err) {
    const code = (err as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

export function isRateLimitedError(err: unknown): boolean {
  return getHttpStatus(err) === 429;
}

/** Pause paced gateway queues after throttling (429). */
export function pauseGatewayQueues(ms = 3000): void {
  thumbnailQueue.pause(ms);
  shareTokenQueue.pause(ms);
  messengerQueue.pause(ms);
}

/** Retries transient gateway throttling (429) with exponential backoff. */
export async function withGateway429Retry<T>(
  fn: () => Promise<T>,
  label: string,
  options?: { maxAttempts?: number; baseMs?: number }
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const baseMs = options?.baseMs ?? 500;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e: unknown) {
      const st = getHttpStatus(e);
      if (st === 429 && attempt < maxAttempts - 1) {
        const wait = baseMs * 2 ** attempt;
        pauseGatewayQueues(wait);
        console.warn(`[GatewayRetry] ${label}: HTTP 429, backing off (ms)`, wait);
        await sleep(wait);
        continue;
      }
      throw e;
    }
  }
  throw new Error(`[GatewayRetry] ${label}: retry loop exhausted`);
}
