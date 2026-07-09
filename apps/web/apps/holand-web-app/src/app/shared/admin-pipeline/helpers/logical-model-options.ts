import type { LlmModel, LogicalCatalogEntry, LlmPool } from '@/types/pipeline-admin.types';
import { pipelineAdminService } from '@/services/pipeline-admin.service';

export interface LogicalModelOption {
  value: string;
  label: string;
  physicalHint?: string;
  healthy?: boolean | null;
}

/** Resolve logical_id from enriched field or metadata. */
export function resolveLogicalId(model: LlmModel): string {
  if (model.logical_id?.trim()) return model.logical_id.trim();
  const meta = pipelineAdminService.parseModelMeta(model);
  const fromMeta = meta?.logical_id;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
  return model.name;
}

export function physicalNameForDebug(model: LlmModel): string {
  return model.name;
}

export function buildLogicalSelectOptions(
  models: LlmModel[],
  catalog: LogicalCatalogEntry[] = [],
  filter?: { activeOnly?: boolean; healthyOnly?: boolean }
): LogicalModelOption[] {
  const map = new Map<string, LogicalModelOption>();

  for (const c of catalog) {
    if (!c.logical_id) continue;
    map.set(c.logical_id, {
      value: c.logical_id,
      label: c.display_name ? `${c.logical_id} — ${c.display_name}` : c.logical_id,
    });
  }

  for (const m of models) {
    if (filter?.activeOnly && !m.is_active) continue;
    if (filter?.healthyOnly && m.health?.healthy === false) continue;
    const logical = resolveLogicalId(m);
    if (!logical || map.has(logical)) continue;
    map.set(logical, {
      value: logical,
      label: logical,
      physicalHint: m.name,
      healthy: m.health?.healthy ?? null,
    });
  }

  return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
}

/** Index pools by logical_id for replica lookup. */
export function indexPoolsByLogicalId(pools: LlmPool[]): Map<string, LlmPool> {
  const map = new Map<string, LlmPool>();
  for (const p of pools) {
    if (p.logical_id) map.set(p.logical_id, p);
  }
  return map;
}

export function findModelsForLogicalId(
  models: LlmModel[],
  logicalId: string
): LlmModel[] {
  return models.filter((m) => resolveLogicalId(m) === logicalId);
}

/** Find model by physical name or logical_id (for topology focus / hydrate). */
export function findModelByEntityId(
  models: LlmModel[],
  entityId: string
): LlmModel | undefined {
  const trimmed = entityId.trim();
  if (!trimmed) return undefined;
  return (
    models.find((m) => m.name === trimmed) ??
    models.find((m) => resolveLogicalId(m) === trimmed)
  );
}

/** Map binding value (physical name or logical_id) to canonical logical_id for API payloads. */
export function normalizeBindingModelId(models: LlmModel[], value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  const byLogical = models.find((m) => resolveLogicalId(m) === trimmed);
  if (byLogical) return resolveLogicalId(byLogical);
  const byName = models.find((m) => m.name === trimmed);
  if (byName) return resolveLogicalId(byName);
  return trimmed;
}
