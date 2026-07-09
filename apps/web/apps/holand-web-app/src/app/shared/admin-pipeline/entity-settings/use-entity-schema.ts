'use client';

import { useEffect, useState } from 'react';
import type { TopologyEntityKind } from '../topology-board/helpers/topology-board-types';
import type { EntitySettingsSchema } from './schema-types';
import { fetchEntitySchema, getEntitySchema } from './get-entity-schema';

export function useEntitySchema(kind: TopologyEntityKind | 'edge') {
  const [schema, setSchema] = useState<EntitySettingsSchema | null>(() => getEntitySchema(kind));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchEntitySchema(kind).then((s) => {
      if (!cancelled) {
        setSchema(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return { schema, loading };
}
