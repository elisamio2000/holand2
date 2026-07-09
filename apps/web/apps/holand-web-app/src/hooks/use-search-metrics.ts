'use client';

import { useEffect, useState } from 'react';
import { oneSearchApi, type SearchMetricsResponse } from '@/services/one-search-api.service';

export function useSearchMetrics(window = '24h', enabled = true) {
  const [data, setData] = useState<SearchMetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    void oneSearchApi
      .getMetrics(window)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(null);
          setError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [window, enabled]);

  return { data, loading, error };
}
