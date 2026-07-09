'use client';

import { useEffect, useMemo, useState } from 'react';
import { pipelineAdminService } from '@/services/pipeline-admin.service';
import type { LlmModel, LogicalCatalogEntry } from '@/types/pipeline-admin.types';
import {
  buildLogicalSelectOptions,
  type LogicalModelOption,
} from '../helpers/logical-model-options';

export function useLogicalModelOptions(
  models: LlmModel[],
  filter?: { activeOnly?: boolean; healthyOnly?: boolean }
) {
  const [catalog, setCatalog] = useState<LogicalCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const c = await pipelineAdminService.listLogicalCatalog().catch(() => []);
        if (!cancelled) setCatalog(c);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options: LogicalModelOption[] = useMemo(
    () => buildLogicalSelectOptions(models, catalog, filter),
    [models, catalog, filter]
  );

  return { catalog, options, loading };
}
