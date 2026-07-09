'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTopologySelectionStore } from '../store/topology-selection-store';

/** Sync graph focus param with shared selection store. */
export function useTopologySelectionSync(): void {
  const searchParams = useSearchParams();

  useEffect(() => {
    const focus = searchParams.get('focus');
    if (!focus) return;
    const idx = focus.indexOf(':');
    if (idx <= 0) return;
    const kind = focus.slice(0, idx);
    const id = decodeURIComponent(focus.slice(idx + 1));
    useTopologySelectionStore.getState().setSelectedEntity({
      kind: kind as 'route',
      id,
    });
  }, [searchParams]);
}
