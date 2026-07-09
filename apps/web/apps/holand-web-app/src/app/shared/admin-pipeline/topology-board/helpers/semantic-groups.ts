import type { ToolRegistryEntry } from '@/types/pipeline-admin.types';
import type { EntityCatalogEntry } from './topology-catalog';
import type { TopologyNode } from './topology-board-types';
import type { TopologyPipelineData } from './topology-board-types';

export type SemanticGroupId =
  | 'embedding'
  | 'chat'
  | 'image'
  | 'audio'
  | 'analysis'
  | 'infra'
  | 'other';

export const SEMANTIC_GROUPS: Array<{
  id: SemanticGroupId;
  labelKey: string;
  fallback: string;
  color: string;
}> = [
  { id: 'embedding', labelKey: 'pipeline.topology.semantic.embedding', fallback: 'Embedding', color: 'bg-violet-500' },
  { id: 'chat', labelKey: 'pipeline.topology.semantic.chat', fallback: 'Chat', color: 'bg-blue-500' },
  { id: 'image', labelKey: 'pipeline.topology.semantic.image', fallback: 'Image', color: 'bg-pink-500' },
  { id: 'audio', labelKey: 'pipeline.topology.semantic.audio', fallback: 'Audio', color: 'bg-teal-500' },
  { id: 'analysis', labelKey: 'pipeline.topology.semantic.analysis', fallback: 'Analysis', color: 'bg-amber-500' },
  { id: 'infra', labelKey: 'pipeline.topology.semantic.infra', fallback: 'Infra', color: 'bg-slate-500' },
  { id: 'other', labelKey: 'pipeline.topology.semantic.other', fallback: 'Other', color: 'bg-gray-400' },
];

function norm(s: string): string {
  return s.toLowerCase().trim();
}

export function resolveToolSemanticGroup(tool: Pick<ToolRegistryEntry, 'category' | 'tags' | 'llm_api' | 'tool_id'>): SemanticGroupId {
  const cat = norm(tool.category ?? '');
  const tags = (tool.tags ?? []).map(norm);
  const id = norm(tool.tool_id);
  const api = norm(tool.llm_api ?? '');

  if (api === 'embed' || cat.includes('embed') || tags.some((t) => t.includes('embed'))) {
    return 'embedding';
  }
  if (api === 'image' || cat.includes('image') || id.includes('image') || tags.some((t) => t.includes('image'))) {
    return 'image';
  }
  if (cat.includes('audio') || id.includes('audio') || tags.some((t) => t.includes('audio'))) {
    return 'audio';
  }
  if (api === 'chat' || cat.includes('chat') || cat.includes('llm')) {
    return 'chat';
  }
  if (
    cat.includes('analysis') ||
    id.includes('analysis') ||
    id.startsWith('analysis_') ||
    tags.some((t) => t.includes('analysis'))
  ) {
    return 'analysis';
  }
  if (cat.includes('infra') || cat.includes('system')) {
    return 'infra';
  }
  return 'other';
}

export function resolveCatalogSemanticGroup(entry: EntityCatalogEntry): SemanticGroupId | null {
  if (entry.semanticGroup) return entry.semanticGroup;
  if (entry.kind === 'tool' || entry.kind === 'plugin') return entry.semanticGroup ?? 'other';
  if (entry.kind === 'model') {
    const task = norm(entry.task ?? entry.sub ?? '');
    if (task.includes('embed')) return 'embedding';
    if (task.includes('image')) return 'image';
    if (task.includes('audio')) return 'audio';
    if (task.includes('chat') || task.includes('generate')) return 'chat';
    return 'other';
  }
  if (entry.kind === 'endpoint' || entry.kind === 'remoteNode') return 'infra';
  return null;
}

export function resolveNodeSemanticGroup(
  node: TopologyNode,
  pipelineData: TopologyPipelineData | null
): SemanticGroupId | null {
  const kind = node.data.kind;
  if (kind === 'group') return null;

  if (kind === 'tool' && pipelineData) {
    const tool = pipelineData.tools.find((t) => t.tool_id === node.data.entityId);
    if (tool) return resolveToolSemanticGroup(tool);
  }
  if (kind === 'plugin') return 'other';
  if (kind === 'model') {
    const task = norm(node.data.model?.task ?? '');
    if (task.includes('embed')) return 'embedding';
    if (task.includes('image')) return 'image';
    if (task.includes('audio')) return 'audio';
    return 'chat';
  }
  if (kind === 'endpoint' || kind === 'remoteNode') return 'infra';
  if (kind === 'route' || kind === 'role') return 'chat';
  if (kind === 'service') return 'other';
  return null;
}

export function groupCatalogBySemantic(
  items: EntityCatalogEntry[]
): Array<{ groupId: SemanticGroupId; items: EntityCatalogEntry[] }> {
  const map = new Map<SemanticGroupId, EntityCatalogEntry[]>();
  items.forEach((item) => {
    const g = resolveCatalogSemanticGroup(item) ?? 'other';
    const list = map.get(g) ?? [];
    list.push(item);
    map.set(g, list);
  });
  return SEMANTIC_GROUPS.filter((g) => map.has(g.id)).map((g) => ({
    groupId: g.id,
    items: map.get(g.id)!,
  }));
}

export function collectToolCategories(catalog: EntityCatalogEntry[]): string[] {
  const cats = new Set<string>();
  catalog.forEach((e) => {
    if (e.category) cats.add(e.category);
  });
  return [...cats].sort();
}
