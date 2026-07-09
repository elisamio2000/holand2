'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/** Bidirectional URL sync for list/board selection highlight. */
export function useTopologySync() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const highlightParam = searchParams.get('highlight') ?? '';
  const highlightedIds = useMemo(
    () => (highlightParam ? highlightParam.split(',').filter(Boolean) : []),
    [highlightParam]
  );

  const syncHighlightToUrl = useCallback(
    (ids: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      const next = ids.length ? ids.join(',') : '';
      const current = params.get('highlight') ?? '';
      if (next === current) return;
      if (next) params.set('highlight', next);
      else params.delete('highlight');
      router.replace(`/admin/pipeline?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  return { highlightedIds, syncHighlightToUrl, highlightParam };
}
