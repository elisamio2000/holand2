/**
 * Shared graph → JSON payload for static HTML exports (2D / 3D).
 */

import type { CommunityReport, GraphData, GraphLink, GraphNode } from '@/types/graph-explorer.types';
import { ENTITY_TYPE_CONFIG, RELATION_TYPE_CONFIG } from '@/config/graph-config';

export const COMMUNITY_HEX = [
  '#3b82f6',
  '#f97316',
  '#22c55e',
  '#eab308',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#84cc16',
];

export function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Prevent `</script>` inside inlined UMD from terminating the host HTML script tag. */
export function sanitizeInlineScriptContent(js: string): string {
  return js.replace(/<\/script>/gi, '<\\/script>');
}

export function linkEndpointId(end: string | GraphNode): string {
  return typeof end === 'string' ? end : end.id;
}

export function buildTypeColorsJson(): string {
  const map: Record<string, string> = { default: '#6b7280', entity: '#6b7280' };
  Object.entries(ENTITY_TYPE_CONFIG).forEach(([k, v]) => {
    map[k] = v.color;
  });
  return JSON.stringify(map);
}

/** Relation stroke colors for 3D export links (hex — polished-safe). */
export function buildRelationColorsJson(): string {
  const map: Record<string, string> = { default: '#94a3b8' };
  Object.entries(RELATION_TYPE_CONFIG).forEach(([k, v]) => {
    map[k] = v.color;
  });
  return JSON.stringify(map);
}

export function buildLegendItemsHtml(): string {
  return Object.entries(ENTITY_TYPE_CONFIG)
    .filter(([k]) => k !== 'unknown')
    .slice(0, 12)
    .map(
      ([k, v]) =>
        `<div class="legend-item"><span class="legend-dot" style="background:${v.color}"></span><span>${escHtml(v.label)}</span></div>`
    )
    .join('');
}

export interface ExportSerializeOptions {
  includeNodeProperties: boolean;
  /** Pass simulation x,y,z through when present (better frozen layout in export). */
  includeSavedPositions: boolean;
}

export function serializeExportNodes(graphData: GraphData, o: ExportSerializeOptions) {
  return graphData.nodes.map((n) => {
    const row: Record<string, unknown> = {
      id: n.id,
      label: n.label,
      type: n.type,
      community_id: n.community_id,
      description: n.description ?? '',
      connectionCount: n.connectionCount ?? 0,
    };
    if (n.origin) row.origin = n.origin;
    if (n.case_id) row.case_id = n.case_id;
    if (n.tags?.length) row.tags = n.tags;
    if (o.includeNodeProperties) row.properties = n.properties;
    if (o.includeSavedPositions) {
      const gn = n as GraphNode & { x?: number; y?: number; z?: number };
      if (gn.x != null && gn.y != null) {
        row.x = gn.x;
        row.y = gn.y;
        if (gn.z != null) row.z = gn.z;
      }
    }
    return row;
  });
}

export function serializeExportLinks(graphData: GraphData, o: ExportSerializeOptions) {
  return graphData.links.map((l) => {
    const row: Record<string, unknown> = {
      id: l.id,
      source: linkEndpointId(l.source),
      target: linkEndpointId(l.target),
      relation: String(l.relation),
      strength: l.strength ?? 5,
      description: (l as GraphLink).description ?? '',
    };
    if (l.origin) row.origin = l.origin;
    if (o.includeNodeProperties) row.properties = l.properties;
    return row;
  });
}

export function communityReportsJson(graphData: GraphData, include: boolean): string {
  if (!include) return '[]';
  return JSON.stringify(graphData.community_reports ?? ([] as CommunityReport[]));
}
