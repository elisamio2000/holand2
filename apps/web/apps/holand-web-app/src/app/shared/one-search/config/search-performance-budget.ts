// ============================================
// One Search — gateway request budget (SMART_FALLBACK=off)
// ============================================

import type { OneSearchExecutionMeta } from '@/types/one-search.types';

/** Max gateway tool calls per query when smart_search path is healthy. */
export const SEARCH_GATEWAY_CALL_BUDGET = 2;

/** Soft target for time-to-results on LAN (ms). */
export const SEARCH_TOOK_MS_SOFT_TARGET = 3000;

export interface SearchPerformanceBudgetResult {
  ok: boolean;
  callCount: number;
  callBudget: number;
  tookMs?: number;
  tookMsOverTarget: boolean;
  usedFallback: boolean;
  rateLimited: boolean;
  reasons: string[];
}

export function evaluateSearchPerformanceBudget(
  meta: OneSearchExecutionMeta | null | undefined
): SearchPerformanceBudgetResult | null {
  if (!meta) return null;

  const callCount = meta.calls?.length ?? 0;
  const reasons: string[] = [];
  let ok = true;

  if (callCount > SEARCH_GATEWAY_CALL_BUDGET) {
    ok = false;
    reasons.push(`calls:${callCount}>${SEARCH_GATEWAY_CALL_BUDGET}`);
  }

  if (meta.usedTempFederatedFallback) {
    ok = false;
    reasons.push('temp-federated-fallback');
  }

  if (meta.rateLimited) {
    ok = false;
    reasons.push('rate-limited');
  }

  const tookMsOverTarget =
    meta.tookMs != null && meta.tookMs > SEARCH_TOOK_MS_SOFT_TARGET;
  if (tookMsOverTarget) {
    reasons.push(`slow:${meta.tookMs}ms`);
  }

  return {
    ok,
    callCount,
    callBudget: SEARCH_GATEWAY_CALL_BUDGET,
    tookMs: meta.tookMs,
    tookMsOverTarget,
    usedFallback: Boolean(meta.usedTempFederatedFallback),
    rateLimited: Boolean(meta.rateLimited),
    reasons,
  };
}
