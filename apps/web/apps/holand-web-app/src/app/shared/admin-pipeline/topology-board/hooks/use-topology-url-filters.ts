'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTopologyDisplayFilterStore } from '../store/topology-display-filter-store';

/** Apply topology deep-link query params to the display filter store on mount / URL change. */
export function useTopologyUrlFilters(): void {
  const searchParams = useSearchParams();
  const patch = useTopologyDisplayFilterStore((s) => s.patch);

  useEffect(() => {
    const unbound = searchParams.get('unbound') === '1';
    const status = searchParams.get('status');
    const unassigned = searchParams.get('unassigned') === '1';
    const required = searchParams.get('required') === '1';
    const unhealthy = searchParams.get('unhealthy') === '1';
    const modality = searchParams.get('modality');

    patch({
      status: unbound || status === 'needsBinding' ? 'needsBinding' : 'all',
      roleUnassignedOnly: unassigned,
      roleRequiredOnly: required,
      unhealthyRoutesOnly: unhealthy,
      modality: modality || null,
    });
  }, [searchParams, patch]);
}
