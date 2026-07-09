// ============================================
// graph_explorer.graph_search → OneSearchHit
// ============================================

import { routes } from '@/config/routes';
import type { OneSearchHit } from '@/types/one-search.types';

export const GS_TOOL = 'plugin.graph_explorer.graph_search';
export const GS_ENDPOINT = '/tools/plugin_graph_explorer_graph_search/execute';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function extractNodesFromUi(ui: Record<string, unknown> | undefined): OneSearchHit[] {
  if (!ui) return [];
  const hits: OneSearchHit[] = [];

  const nodes = ui.nodes ?? ui.entities;
  if (Array.isArray(nodes)) {
    nodes.forEach((raw, i) => {
      if (!isPlainObject(raw)) return;
      const label = String(raw.label ?? raw.name ?? raw.title ?? `Node ${i + 1}`);
      const id = String(raw.id ?? raw.element_id ?? `graph-node-${i}`);
      hits.push({
        id: `graph-${id}`,
        title: label,
        snippet: String(raw.summary ?? raw.description ?? raw.type ?? '').slice(0, 200),
        href: routes.graphExplorer,
        meta: {
          node_type: raw.type ?? raw.labels,
          element_id: raw.element_id ?? raw.id,
          source: GS_TOOL,
          sourceEndpoint: GS_ENDPOINT,
          lane: 'graph',
        },
      });
    });
  }

  const citations = ui.citations ?? ui.results;
  if (Array.isArray(citations)) {
    citations.forEach((raw, i) => {
      if (!isPlainObject(raw)) return;
      hits.push({
        id: `graph-cite-${i}`,
        title: String(raw.title ?? raw.label ?? `Citation ${i + 1}`),
        snippet: String(raw.snippet ?? raw.text ?? '').slice(0, 200),
        href: routes.graphExplorer,
        meta: { source: GS_TOOL, sourceEndpoint: GS_ENDPOINT, lane: 'graph' },
      });
    });
  }

  return hits;
}

export function mapGraphSearchToHits(
  answer: string,
  ui: Record<string, unknown> | undefined,
  query: string,
  args: Record<string, unknown>
): OneSearchHit[] {
  const fromUi = extractNodesFromUi(ui);
  if (fromUi.length > 0) {
    return fromUi.map((h) => ({
      ...h,
      meta: { ...h.meta, sourceArgs: args },
    }));
  }

  if (answer.trim()) {
    return [
      {
        id: `graph-answer-${query.slice(0, 24).replace(/\s+/g, '-')}`,
        title: `Graph insight: ${query.slice(0, 60)}${query.length > 60 ? '…' : ''}`,
        snippet: answer.slice(0, 320),
        href: `${routes.graphExplorer}?q=${encodeURIComponent(query)}`,
        meta: {
          source: GS_TOOL,
          sourceEndpoint: GS_ENDPOINT,
          sourceArgs: args,
          lane: 'graph',
          nl_answer: true,
        },
      },
    ];
  }

  return [];
}
