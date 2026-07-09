// ============================================
// useFunnelSummary — fetches the assessment-completion funnel summary
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { analyticsService } from '@/services/analytics.service';
import type { FunnelSummaryResponse } from '@/types/analytics.types';

interface UseFunnelSummaryResult {
  summary: FunnelSummaryResponse | null;
  isLoading: boolean;
  error: string | null;
}

export function useFunnelSummary(): UseFunnelSummaryResult {
  const [summary, setSummary] = useState<FunnelSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await analyticsService.getFunnelSummary();
        if (!cancelled) setSummary(result);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { summary, isLoading, error };
}
