// ============================================
// Holand Graph Explorer Service
// API calls for Knowledge Graph data
// ============================================

import { gatewayClient } from '@/lib/api-client';
import { assertGatewayToolSuccess } from '@/utils/gateway-tool-success';
import { toolExecutePath } from '@/utils/tool-id';
import { getCommunityColor } from '@/config/graph-config';
import { normalizeSubgraphPluginPayload } from '@/services/graph-payload-normalize';
import type {
  RawGraphData,
  GraphData,
  GraphNode,
  GraphLink,
  GraphCaseListItem,
  GraphArtifactListItem,
  GraphExplorerOverview,
  GraphExplorerSchema,
} from '@/types/graph-explorer.types';

// ==========================================
// Data Transformation
// ==========================================

/**
 * Transform raw backend response into renderable GraphData.
 *
 * Converts RawEntity[] â†’ GraphNode[] with D3 fields and UI state,
 * and RawRelationship[] â†’ GraphLink[] with connection counting.
 *
 * @param raw - Raw graph data from backend API
 * @returns GraphData ready for react-force-graph rendering
 */
export function transformRawToGraphData(raw: RawGraphData): GraphData {
  console.info('[GraphService] Transforming raw data:', {
    entities: raw.entities.length,
    relationships: raw.relationships.length,
    communities: raw.communities.length,
  });

  const nodeMap = new Map<string, GraphNode>();
  const aliasToId = new Map<string, string>();
  const addAlias = (alias: unknown, id: string) => {
    if (alias == null) return;
    const key = String(alias).trim();
    if (!key) return;
    if (!aliasToId.has(key)) aliasToId.set(key, id);
  };

  raw.entities.forEach((entity) => {
    const id = entity.id || entity.name;
    const node: GraphNode = {
      id,
      label: entity.name,
      type: entity.type,
      description: entity.description ?? '',
      community_id: entity.community_id,
      case_id: entity.case_id,
      artifact_id: entity.artifact_id,
      origin: entity.origin,
      properties: entity.properties,
      metrics: entity.metrics,
      timestamps: entity.timestamps,
      tags: entity.tags,
      status: entity.status,
      visibility: entity.visibility,
      communityColor: getCommunityColor(entity.community_id),
      connectionCount: 0,
      hidden: false,
      pinned: false,
      locked: false,
      expanded: true,
    };
    nodeMap.set(id, node);
    // WHY broaden endpoint alias coverage:
    // graph payloads may reference nodes by name, element keys, UUIDs, or business IDs.
    addAlias(id, id);
    addAlias(entity.name, id);
    addAlias(entity.properties?.id, id);
    addAlias(entity.properties?.name, id);
    addAlias(entity.properties?.label, id);
    addAlias(entity.properties?.elementKey, id);
    addAlias((entity.properties as Record<string, unknown> | undefined)?.uuid, id);
    addAlias((entity.properties as Record<string, unknown> | undefined)?.elementId, id);
  });

  const resolveEndpoint = (endpoint: string): string => {
    const key = String(endpoint ?? '').trim();
    if (!key) return key;
    if (nodeMap.has(key)) return key;
    const mapped = aliasToId.get(key);
    return mapped && nodeMap.has(mapped) ? mapped : key;
  };

  const links: GraphLink[] = raw.relationships.map((rel, idx) => {
    const source = resolveEndpoint(rel.source);
    const target = resolveEndpoint(rel.target);
    const srcNode = nodeMap.get(source);
    const tgtNode = nodeMap.get(target);
    if (srcNode) srcNode.connectionCount = (srcNode.connectionCount ?? 0) + 1;
    if (tgtNode) tgtNode.connectionCount = (tgtNode.connectionCount ?? 0) + 1;

    return {
      id: rel.id || `link_${idx}`,
      source,
      target,
      relation: rel.relation,
      description: rel.description ?? '',
      strength: rel.strength,
      weight: rel.weight,
      confidence: rel.confidence,
      case_id: rel.case_id,
      artifact_id: rel.artifact_id,
      origin: rel.origin,
      properties: rel.properties,
      metrics: rel.metrics,
      timestamps: rel.timestamps,
      tags: rel.tags,
      status: rel.status,
      bidirectional: rel.bidirectional,
      visibility: rel.visibility,
      selected: false,
      highlighted: false,
      hidden: false,
    };
  });

  // Deduplicate nodes (nodeMap may have nameâ†’node duplicates)
  const uniqueNodes = Array.from(
    new Map(
      Array.from(nodeMap.values()).map((n) => [n.id, n])
    ).values()
  );

  const knownNodeIds = new Set(uniqueNodes.map((n) => n.id));
  const missingEndpointIds = new Set<string>();
  links.forEach((l) => {
    if (typeof l.source === 'string' && !knownNodeIds.has(l.source)) missingEndpointIds.add(l.source);
    if (typeof l.target === 'string' && !knownNodeIds.has(l.target)) missingEndpointIds.add(l.target);
  });
  if (missingEndpointIds.size > 0) {
    missingEndpointIds.forEach((id) => {
      uniqueNodes.push({
        id,
        label: id,
        type: 'unknown',
        description: '',
        community_id: null,
        case_id: 'local',
        artifact_id: '',
        origin: 'inferred',
        connectionCount: 0,
        communityColor: getCommunityColor(null),
        hidden: false,
        pinned: false,
        locked: false,
        expanded: true,
      });
    });
  }

  const relationTypeCount = new Set(links.map((l) => String(l.relation || 'RELATED_TO'))).size;

  console.info('[GraphService] Transform complete:', {
    nodes: uniqueNodes.length,
    links: links.length,
    relationTypes: relationTypeCount,
    inferredEndpointNodes: missingEndpointIds.size,
  });

  return {
    nodes: uniqueNodes,
    links,
    communities: raw.communities,
    community_reports: raw.community_reports,
    stats: raw.stats,
    extraction_meta: raw.extraction_meta,
  };
}

// ==========================================
// Graph Explorer â€” plugin-only API (tool_runner)
// ==========================================

/** Optional filters when loading a case graph via graph_explorer plugins */
export type GetCaseGraphOptions = {
  /** Artifact UUID â€” passed to plugin_graph_explorer_case_graph / subgraph */
  artifactId?: string;
  /** Neo4j elementId seed for plugin_graph_explorer_subgraph */
  elementId?: string;
};

function isEmptyGraphData(d: GraphData): boolean {
  return d.nodes.length === 0 && d.links.length === 0;
}

function isMeaningfulText(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function linkEndpointId(v: string | GraphNode): string {
  return typeof v === 'string' ? v : v.id;
}

function linkIdentity(l: GraphLink): string {
  const source = linkEndpointId(l.source);
  const target = linkEndpointId(l.target);
  const rel = String(l.relation || 'RELATED_TO');
  return `${source}::${rel}::${target}`;
}

function mergeNodeRichness(base: GraphNode, incoming: GraphNode): GraphNode {
  return {
    ...base,
    ...incoming,
    label: isMeaningfulText(incoming.label) ? incoming.label : base.label,
    description: isMeaningfulText(incoming.description) ? incoming.description : base.description,
    type: incoming.type !== 'unknown' ? incoming.type : base.type,
    case_id: isMeaningfulText(incoming.case_id) ? incoming.case_id : base.case_id,
    artifact_id: isMeaningfulText(incoming.artifact_id) ? incoming.artifact_id : base.artifact_id,
    origin: isMeaningfulText(incoming.origin) ? incoming.origin : base.origin,
    community_id: incoming.community_id ?? base.community_id,
    properties: { ...(base.properties ?? {}), ...(incoming.properties ?? {}) },
    metrics: { ...(base.metrics ?? {}), ...(incoming.metrics ?? {}) },
    timestamps: { ...(base.timestamps ?? {}), ...(incoming.timestamps ?? {}) },
    tags: Array.from(new Set([...(base.tags ?? []), ...(incoming.tags ?? [])])),
  };
}

function mergeLinkRichness(base: GraphLink, incoming: GraphLink): GraphLink {
  return {
    ...base,
    ...incoming,
    relation: incoming.relation || base.relation,
    description: isMeaningfulText(incoming.description) ? incoming.description : base.description,
    strength: typeof incoming.strength === 'number' ? incoming.strength : base.strength,
    source: linkEndpointId(incoming.source) || linkEndpointId(base.source),
    target: linkEndpointId(incoming.target) || linkEndpointId(base.target),
    case_id: isMeaningfulText(incoming.case_id) ? incoming.case_id : base.case_id,
    artifact_id: isMeaningfulText(incoming.artifact_id) ? incoming.artifact_id : base.artifact_id,
    origin: isMeaningfulText(incoming.origin) ? incoming.origin : base.origin,
    properties: { ...(base.properties ?? {}), ...(incoming.properties ?? {}) },
    metrics: { ...(base.metrics ?? {}), ...(incoming.metrics ?? {}) },
    timestamps: { ...(base.timestamps ?? {}), ...(incoming.timestamps ?? {}) },
    tags: Array.from(new Set([...(base.tags ?? []), ...(incoming.tags ?? [])])),
  };
}

function pickRicherExtractionMeta(a?: GraphData['extraction_meta'], b?: GraphData['extraction_meta']) {
  if (!a) return b;
  if (!b) return a;
  const scoreA = (a.num_chunks ?? 0) * 10 + (a.max_gleanings ?? 0);
  const scoreB = (b.num_chunks ?? 0) * 10 + (b.max_gleanings ?? 0);
  return scoreB > scoreA ? b : a;
}

/** Merge two graph payloads (e.g. expand-neighbors into canvas). */
export function mergeGraphData(primary: GraphData, candidate: GraphData | null): GraphData {
  if (!candidate || isEmptyGraphData(candidate)) return primary;
  if (isEmptyGraphData(primary)) return candidate;

  const nodeMap = new Map<string, GraphNode>();
  for (const n of primary.nodes) nodeMap.set(n.id, n);
  for (const n of candidate.nodes) {
    const prev = nodeMap.get(n.id);
    nodeMap.set(n.id, prev ? mergeNodeRichness(prev, n) : n);
  }

  const linkMap = new Map<string, GraphLink>();
  for (const l of primary.links) linkMap.set(l.id || linkIdentity(l), l);
  for (const l of candidate.links) {
    const key = l.id || linkIdentity(l);
    const prev = linkMap.get(key);
    linkMap.set(key, prev ? mergeLinkRichness(prev, l) : l);
  }

  const communityMap = new Map<number | null, GraphData['communities'][number]>();
  for (const c of [...primary.communities, ...candidate.communities]) {
    if (c.community_id == null) continue;
    const prev = communityMap.get(c.community_id);
    communityMap.set(c.community_id, prev ? { ...prev, ...c } : c);
  }

  const reportsMap = new Map<number | null, GraphData['community_reports'][number]>();
  for (const r of [...primary.community_reports, ...candidate.community_reports]) {
    if (r.community_id == null) continue;
    const prev = reportsMap.get(r.community_id);
    reportsMap.set(r.community_id, prev ? { ...prev, ...r } : r);
  }

  const richerStats =
    candidate.stats.entity_count + candidate.stats.relationship_count >=
    primary.stats.entity_count + primary.stats.relationship_count
      ? candidate.stats
      : primary.stats;

  return {
    ...primary,
    nodes: Array.from(nodeMap.values()),
    links: Array.from(linkMap.values()),
    communities: Array.from(communityMap.values()),
    community_reports: Array.from(reportsMap.values()),
    stats: {
      ...richerStats,
      entity_count: nodeMap.size,
      relationship_count: linkMap.size,
      community_count: communityMap.size,
      report_count: reportsMap.size,
    },
    extraction_meta: pickRicherExtractionMeta(primary.extraction_meta, candidate.extraction_meta),
  };
}

/**
 * Merge graphs from multiple cases (same semantics as BackendTab multi-load):
 * dedupe IDs, merge node/link richness, recombine communities.
 */
export function mergeMultipleCaseGraphs(dataSets: GraphData[]): GraphData {
  const nonEmpty = dataSets.filter((d) => !isEmptyGraphData(d));
  if (nonEmpty.length === 0) {
    return {
      nodes: [],
      links: [],
      communities: [],
      community_reports: [],
      stats: {
        entity_count: 0,
        relationship_count: 0,
        community_count: 0,
        report_count: 0,
      },
    };
  }
  let acc = nonEmpty[0];
  for (let i = 1; i < nonEmpty.length; i++) {
    acc = mergeGraphData(acc, nonEmpty[i]);
  }
  return acc;
}

function hasCanvasShape(o: unknown): boolean {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return Array.isArray((o as Record<string, unknown>).nodes);
}

function hasListItemsShape(o: unknown): boolean {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  return Array.isArray((o as Record<string, unknown>).items);
}

function unwrapPluginPayload(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;

  const tryPick = (o: unknown): Record<string, unknown> | null => {
    if (!o || typeof o !== 'object' || Array.isArray(o)) return null;
    const rec = o as Record<string, unknown>;
    if (hasCanvasShape(rec) || hasListItemsShape(rec)) return rec;
    if (rec.data && typeof rec.data === 'object' && !Array.isArray(rec.data)) {
      const inner = rec.data as Record<string, unknown>;
      if (hasCanvasShape(inner) || hasListItemsShape(inner)) return inner;
    }
    return null;
  };

  const direct = tryPick(b);
  if (direct) return direct;

  const r = b.result;
  if (r && typeof r === 'object') {
    const nested = tryPick(r) ?? tryPick((r as Record<string, unknown>).data);
    if (nested) return nested;
  }

  const ch = b.channels;
  if (ch && typeof ch === 'object') {
    const c = ch as Record<string, unknown>;
    const ui = tryPick(c.ui);
    if (ui) return ui;
  }

  return tryPick(b.data);
}

async function postGraphPluginExecute(toolId: string, args: Record<string, unknown>) {
  const bodyVariants = [{ arguments: args }, { args }];
  let lastError: unknown = null;
  for (const body of bodyVariants) {
    try {
      const res = await gatewayClient.post<unknown>(toolExecutePath(toolId), body);
      assertGatewayToolSuccess(res);
      return res;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}

function canvasPayloadToGraphData(payload: Record<string, unknown>, caseId: string): GraphData {
  const raw = normalizeSubgraphPluginPayload(payload, caseId);
  return transformRawToGraphData(raw);
}

async function fetchGraphViaCaseGraphPlugin(
  caseId: string,
  artifactId?: string
): Promise<GraphData | null> {
  const args: Record<string, unknown> = { case_id: caseId };
  const aid = artifactId?.trim();
  if (aid) args.artifact_id = aid;

  try {
    const res = await postGraphPluginExecute('plugin.graph_explorer.case_graph', args);
    const inner = unwrapPluginPayload(res.data);
    if (!inner) return null;
    const data = canvasPayloadToGraphData(inner, caseId);
    return isEmptyGraphData(data) ? null : data;
  } catch (e) {
    console.warn('[GraphService] case_graph plugin failed:', { caseId, artifactId, e });
    return null;
  }
}

async function fetchGraphViaSubgraphPlugin(
  caseId: string,
  options?: GetCaseGraphOptions
): Promise<GraphData | null> {
  const artifactId = options?.artifactId?.trim();
  const elementId = options?.elementId?.trim();

  const attempts: { label?: string; args: Record<string, unknown> }[] = [];
  const broadLabels = [
    'Entity',
    'Person',
    'Organization',
    'Location',
    'Event',
    'PhoneNumber',
    'Email',
    'Document',
    'Vehicle',
    'Device',
    'Account',
    'Address',
  ];

  if (elementId) {
    attempts.push({ args: { element_id: elementId } });
  } else if (artifactId) {
    attempts.push({
      args: { match_property: 'artifact_id', match_value: artifactId },
    });
    for (const label of broadLabels) {
      attempts.push({
        label,
        args: { label, match_property: 'artifact_id', match_value: artifactId },
      });
    }
  } else {
    attempts.push({
      args: { match_property: 'case_id', match_value: caseId },
    });
    for (const label of broadLabels) {
      attempts.push({
        label,
        args: { label, match_property: 'case_id', match_value: caseId },
      });
    }
  }

  for (const { args, label } of attempts) {
    try {
      const res = await postGraphPluginExecute('plugin.graph_explorer.subgraph', args);
      const inner = unwrapPluginPayload(res.data);
      if (!inner) continue;
      const data = canvasPayloadToGraphData(inner, caseId);
      if (!isEmptyGraphData(data)) {
        console.info('[GraphService] subgraph plugin matched:', { label: label ?? 'element_id' });
        return data;
      }
    } catch (e) {
      console.warn('[GraphService] subgraph plugin attempt failed:', { label, error: e });
    }
  }
  return null;
}

function parseCaseListItems(payload: Record<string, unknown>): GraphCaseListItem[] {
  const raw = payload.items;
  if (!Array.isArray(raw)) return [];
  const out: GraphCaseListItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const case_id = String(r.case_id ?? '').trim();
    if (!case_id) continue;
    out.push({
      case_id,
      node_count: Number(r.node_count ?? 0) || 0,
    });
  }
  return out;
}

function parseArtifactListItems(payload: Record<string, unknown>): GraphArtifactListItem[] {
  const raw = payload.items;
  if (!Array.isArray(raw)) return [];
  const out: GraphArtifactListItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const artifact_id = String(r.artifact_id ?? '').trim();
    if (!artifact_id) continue;
    const item: GraphArtifactListItem = {
      artifact_id,
      node_count: Number(r.node_count ?? 0) || 0,
    };
    const label = r.label;
    if (typeof label === 'string' && label.trim()) item.label = label.trim();
    out.push(item);
  }
  return out;
}

export const graphService = {
  /**
   * List cases present in Neo4j via plugin_graph_explorer_cases.
   */
  async listCases(options?: { search?: string; limit?: number }): Promise<{
    count: number;
    items: GraphCaseListItem[];
  }> {
    const args: Record<string, unknown> = {};
    const search = options?.search?.trim();
    if (search) args.search = search;
    if (options?.limit != null) args.limit = options.limit;

    const res = await postGraphPluginExecute('plugin.graph_explorer.cases', args);
    const inner = unwrapPluginPayload(res.data);
    const items = inner ? parseCaseListItems(inner) : [];
    console.info('[GraphService] cases plugin:', { count: items.length });
    return { count: items.length, items };
  },

  /**
   * List artifacts for a case via plugin_graph_explorer_artifacts.
   */
  async listArtifacts(
    caseId: string,
    options?: { search?: string; limit?: number }
  ): Promise<{ case_id: string; count: number; items: GraphArtifactListItem[] }> {
    const cid = caseId.trim();
    const args: Record<string, unknown> = { case_id: cid };
    const search = options?.search?.trim();
    if (search) args.search = search;
    if (options?.limit != null) args.limit = options.limit;

    const res = await postGraphPluginExecute('plugin.graph_explorer.artifacts', args);
    const inner = unwrapPluginPayload(res.data);
    const items = inner ? parseArtifactListItems(inner) : [];
    console.info('[GraphService] artifacts plugin:', { caseId: cid, count: items.length });
    return { case_id: cid, count: items.length, items };
  },

  /**
   * Load full graph for a case (plugin-only).
   * - elementId â†’ subgraph
   * - otherwise â†’ case_graph (+ subgraph fallback)
   */
  async getCaseGraph(caseId: string, options?: GetCaseGraphOptions): Promise<GraphData> {
    const artifactId = options?.artifactId?.trim();
    const elementId = options?.elementId?.trim();
    console.info('[GraphService] Fetching case graph (plugin):', {
      caseId,
      artifactId: artifactId || undefined,
      elementId: elementId || undefined,
    });

    if (elementId) {
      const viaSubgraph = await fetchGraphViaSubgraphPlugin(caseId, { elementId });
      if (viaSubgraph && !isEmptyGraphData(viaSubgraph)) return viaSubgraph;
      throw new Error(`No graph data for elementId ${elementId}`);
    }

    const viaCaseGraph = await fetchGraphViaCaseGraphPlugin(caseId, artifactId);
    if (viaCaseGraph && !isEmptyGraphData(viaCaseGraph)) return viaCaseGraph;

    const viaSubgraph = await fetchGraphViaSubgraphPlugin(caseId, { artifactId });
    if (viaSubgraph && !isEmptyGraphData(viaSubgraph)) return viaSubgraph;

    throw new Error(`No graph data in Neo4j for case ${caseId}`);
  },

  /** Expand k-hop neighborhood around a node elementId. */
  async expandSubgraph(elementId: string, caseId: string, hops = 2): Promise<GraphData> {
    const res = await postGraphPluginExecute('plugin.graph_explorer.subgraph', {
      element_id: elementId,
      hops,
    });
    const inner = unwrapPluginPayload(res.data);
    if (!inner) throw new Error('Subgraph expand returned empty payload');
    return canvasPayloadToGraphData(inner, caseId);
  },

  /** Shortest path between two elementIds via plugin_graph_explorer_path_find. */
  async findPathBetweenElements(
    fromElementId: string,
    toElementId: string,
    options?: { maxHops?: number; allPaths?: boolean }
  ): Promise<{ paths: Array<{ length: number; nodes: unknown[]; relationships: unknown[] }> }> {
    const args: Record<string, unknown> = {
      from: { element_id: fromElementId },
      to: { element_id: toElementId },
    };
    if (options?.maxHops != null) args.max_hops = options.maxHops;
    if (options?.allPaths != null) args.all_paths = options.allPaths;

    const res = await postGraphPluginExecute('plugin.graph_explorer.path_find', args);
    const inner = unwrapPluginPayload(res.data);
    const paths = inner && Array.isArray(inner.paths) ? inner.paths : [];
    return { paths: paths as Array<{ length: number; nodes: unknown[]; relationships: unknown[] }> };
  },

  /** Natural-language graph search via plugin_graph_explorer_graph_search. */
  async graphSearch(
    queries: string[],
    question?: string
  ): Promise<{ answer: string; ui?: Record<string, unknown> }> {
    const res = await postGraphPluginExecute('plugin.graph_explorer.graph_search', {
      queries,
      question: question ?? '',
    });
    const body = res.data as Record<string, unknown>;
    const channels =
      body?.channels && typeof body.channels === 'object'
        ? (body.channels as Record<string, unknown>)
        : {};
    const llm =
      channels.llm && typeof channels.llm === 'object'
        ? (channels.llm as Record<string, unknown>)
        : {};
    const answer = String(llm.text ?? llm.summary ?? '').trim();
    const ui =
      channels.ui && typeof channels.ui === 'object'
        ? (channels.ui as Record<string, unknown>)
        : undefined;
    return { answer, ui };
  },

  /** Landing health/schema via plugin_graph_explorer_overview. */
  async fetchOverview(): Promise<GraphExplorerOverview | null> {
    try {
      const res = await postGraphPluginExecute('plugin.graph_explorer.overview', {
        include: ['health', 'schema', 'indexes'],
        top_labels: 5,
      });
      const inner = unwrapPluginPayload(res.data);
      if (!inner) return null;
      const indexes =
        inner.indexes && typeof inner.indexes === 'object'
          ? (inner.indexes as Record<string, unknown>)
          : {};
      return {
        health:
          inner.health && typeof inner.health === 'object'
            ? (inner.health as Record<string, unknown>)
            : undefined,
        schema:
          inner.schema && typeof inner.schema === 'object'
            ? (inner.schema as GraphExplorerOverview['schema'])
            : undefined,
        graphrag_ready: Boolean(indexes.graphrag_ready),
      };
    } catch (e) {
      console.warn('[GraphService] overview plugin failed:', e);
      return null;
    }
  },

  /** Schema introspection via plugin_graph_explorer_schema. */
  async fetchSchema(includeCounts = false): Promise<GraphExplorerSchema | null> {
    try {
      const res = await postGraphPluginExecute('plugin.graph_explorer.schema', {
        include_counts: includeCounts,
      });
      const inner = unwrapPluginPayload(res.data);
      if (!inner) return null;
      return {
        labels: Array.isArray(inner.labels) ? (inner.labels as string[]) : [],
        relationship_types: Array.isArray(inner.relationship_types)
          ? (inner.relationship_types as string[])
          : [],
        property_keys: Array.isArray(inner.property_keys)
          ? (inner.property_keys as string[])
          : [],
        graphrag_ready: Boolean(inner.graphrag_ready),
      };
    } catch (e) {
      console.warn('[GraphService] schema plugin failed:', e);
      return null;
    }
  },

  /** @deprecated Use listCases â€” kept for backward compatibility during migration */
  async fetchNeo4jCaseIdSetViaReadQuery(): Promise<Set<string> | null> {
    try {
      const { items } = await graphService.listCases({ limit: 2000 });
      return new Set(items.map((i) => i.case_id));
    } catch {
      return null;
    }
  },

  /** True when case_graph or subgraph returns data for this case. */
  async caseHasNeo4jSubgraphData(caseId: string): Promise<boolean> {
    try {
      const data = await fetchGraphViaCaseGraphPlugin(caseId);
      if (data && !isEmptyGraphData(data)) return true;
      const via = await fetchGraphViaSubgraphPlugin(caseId, undefined);
      return !!(via && !isEmptyGraphData(via));
    } catch {
      return false;
    }
  },
};

