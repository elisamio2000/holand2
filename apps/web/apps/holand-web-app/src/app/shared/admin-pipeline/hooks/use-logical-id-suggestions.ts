'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type { LlmPool, LogicalCatalogEntry } from '@/types/pipeline-admin.types';

export function useLogicalIdSuggestions() {
  const [pools, setPools] = useState<LlmPool[]>([]);
  const [catalog, setCatalog] = useState<LogicalCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [p, c] = await Promise.all([
          pipelineAdminService.listPools().catch(() => []),
          pipelineAdminService
            .listLogicalCatalog({ suggest: true, input_modalities: ['text'], output_modalities: ['text'] })
            .catch(() => []),
        ]);
        if (!cancelled) {
          setPools(p);
          setCatalog(c);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    const ids = new Set<string>();
    for (const p of pools) {
      if (p.logical_id) ids.add(p.logical_id);
    }
    for (const c of catalog) {
      if (c.logical_id) ids.add(c.logical_id);
    }
    return Array.from(ids).sort();
  }, [pools, catalog]);

  const filterSuggestions = useCallback(
    (input: string) => {
      const q = input.trim().toLowerCase();
      if (!q) return suggestions.slice(0, 20);
      return suggestions.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
    },
    [suggestions]
  );

  const filterSuggestionsForModalities = useCallback(
    (
      input: string,
      inputModalities?: string[],
      outputModalities?: string[]
    ) => {
      const inSet = new Set(inputModalities ?? []);
      const outSet = new Set(outputModalities ?? []);
      const filteredCatalog =
        inSet.size === 0 && outSet.size === 0
          ? catalog
          : catalog.filter((c) => {
              const cIn = c.input_modalities ?? [];
              const cOut = c.output_modalities ?? [];
              const inOk =
                inSet.size === 0 || cIn.some((m) => inSet.has(m)) || cIn.length === 0;
              const outOk =
                outSet.size === 0 || cOut.some((m) => outSet.has(m)) || cOut.length === 0;
              return inOk && outOk;
            });
      const ids = new Set<string>();
      for (const c of filteredCatalog) {
        if (c.logical_id) ids.add(c.logical_id);
      }
      for (const p of pools) {
        if (p.logical_id) ids.add(p.logical_id);
      }
      const list = Array.from(ids).sort();
      const q = input.trim().toLowerCase();
      if (!q) return list.slice(0, 20);
      return list.filter((s) => s.toLowerCase().includes(q)).slice(0, 20);
    },
    [catalog, pools]
  );

  return { pools, catalog, suggestions, filterSuggestions, filterSuggestionsForModalities, loading };
}
