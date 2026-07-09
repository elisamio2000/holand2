// ============================================
// graph_explorer.cases → OneSearchHit
// ============================================

import { routes } from '@/config/routes';
import type { GraphCaseListItem } from '@/types/graph-explorer.types';
import type { OneSearchHit } from '@/types/one-search.types';

export const GC_TOOL = 'plugin.graph_explorer.cases';
export const GC_ENDPOINT = '/tools/plugin_graph_explorer_cases/execute';

export function mapGraphCasesToHits(
  items: GraphCaseListItem[],
  query: string,
  args: Record<string, unknown>
): OneSearchHit[] {
  return items.map((item) => ({
    id: `case-${item.case_id}`,
    title: item.case_id,
    snippet: `${item.node_count} graph nodes`,
    href: routes.cases.detail(item.case_id),
    meta: {
      case_id: item.case_id,
      node_count: item.node_count,
      source: GC_TOOL,
      sourceEndpoint: GC_ENDPOINT,
      sourceArgs: args,
      lane: 'cases',
    },
  }));
}
