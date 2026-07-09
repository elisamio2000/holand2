import { gatewayClient } from '@/lib/api-client';
import type { TopologyEntityKind } from '../topology-board/helpers/topology-board-types';
import type { EntitySettingsSchema } from './schema-types';
import { PIPELINE_ENTITY_SCHEMAS } from './pipeline-entity-schema';

const schemaCache = new Map<string, EntitySettingsSchema>();

export function getEntitySchema(
  kind: TopologyEntityKind | 'edge'
): EntitySettingsSchema | null {
  return schemaCache.get(kind) ?? PIPELINE_ENTITY_SCHEMAS[kind] ?? null;
}

/**
 * Fetch entity schema from backend with static fallback.
 * @endpoint GET /admin/pipeline/entity-schemas/{kind}
 */
export async function fetchEntitySchema(
  kind: TopologyEntityKind | 'edge'
): Promise<EntitySettingsSchema | null> {
  if (schemaCache.has(kind)) {
    return schemaCache.get(kind)!;
  }

  try {
    const { data } = await gatewayClient.get<EntitySettingsSchema>(
      `/admin/pipeline/entity-schemas/${encodeURIComponent(kind)}`
    );
    if (data && Array.isArray(data.sections)) {
      schemaCache.set(kind, data);
      return data;
    }
  } catch (err) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    if (status && status !== 404) {
      console.warn('[fetchEntitySchema] API error, using static fallback:', kind, status);
    }
  }

  const fallback = PIPELINE_ENTITY_SCHEMAS[kind] ?? null;
  if (fallback) {
    schemaCache.set(kind, fallback);
  }
  return fallback;
}

/** Preload schemas for multiple kinds (e.g. on board mount). */
export async function prefetchEntitySchemas(
  kinds: Array<TopologyEntityKind | 'edge'>
): Promise<void> {
  await Promise.all(kinds.map((k) => fetchEntitySchema(k)));
}

export function clearEntitySchemaCache(): void {
  schemaCache.clear();
}
