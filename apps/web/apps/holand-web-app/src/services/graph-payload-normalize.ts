// ============================================
// Graph payload normalization
// GET /import/detail/{case_id} may return CaseDetail plus graph in various shapes:
// canonical RawGraphData, nested graph blobs, or Neo4j-style { nodes, relationships }.
// ============================================

import type {
  Community,
  CommunityReport,
  EntityType,
  ExtractionMeta,
  GraphStats,
  RawEntity,
  RawGraphData,
  RawRelationship,
} from '@/types/graph-explorer.types';

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/** Merge `community_reports` with `constructed.communityReports` (graph_extract / MS GraphRAG). */
function mergeCommunityReportArrays(...lists: (CommunityReport[] | undefined)[]): CommunityReport[] {
  const map = new Map<number | null, CommunityReport>();
  for (const list of lists) {
    if (!list?.length) continue;
    for (const r of list) {
      if (!r) continue;
      const key = r.community_id ?? null;
      map.set(key, r);
    }
  }
  return Array.from(map.values());
}

function readConstructedCommunityReports(obj: Record<string, unknown>): CommunityReport[] | undefined {
  const c = obj.constructed;
  if (!isRecord(c)) return undefined;
  const reports = c.communityReports;
  if (!Array.isArray(reports)) return undefined;
  return reports as CommunityReport[];
}

function defaultExtractionMeta(): ExtractionMeta {
  return {
    input_length: 0,
    num_chunks: 0,
    entity_types_used: [],
    max_gleanings: 0,
    model: '',
    language: '',
    input_type: 'import_detail',
    classification_source: 'gateway',
    classification_reasoning: '',
    elapsed_ms: 0,
  };
}

function defaultStats(
  entityCount: number,
  relationshipCount: number,
  communityCount: number,
  reportCount: number
): GraphStats {
  return {
    entity_count: entityCount,
    relationship_count: relationshipCount,
    community_count: communityCount,
    report_count: reportCount,
  };
}

function asEntityType(label: string): EntityType {
  const normalized = label.toLowerCase().replace(/\s+/g, '_');
  return normalized as EntityType;
}

/**
 * Neo4j driver returns `properties`; some gateways flatten the same fields onto the node root.
 * Aligns with common KG labels: Person, Entity, … and keys: case_id, artifact_id, elementKey, …
 */
function flattenNeoNode(n: Record<string, unknown>): Record<string, unknown> {
  const p: Record<string, unknown> = isRecord(n.properties) ? { ...n.properties } : {};
  const fromRoot = [
    'case_id',
    'artifact_id',
    'name',
    'title',
    'label',
    'description',
    'elementKey',
    'id',
    'origin',
    'type',
    'extractedEntityType',
    'community_id',
    'communityId',
    'primaryCommunityId',
    'relation',
    'strength',
  ] as const;
  for (const k of fromRoot) {
    if (p[k] === undefined && n[k] !== undefined) p[k] = n[k];
  }
  return p;
}

function flattenNeoRel(r: Record<string, unknown>): Record<string, unknown> {
  const p: Record<string, unknown> = isRecord(r.properties) ? { ...r.properties } : {};
  const fromRoot = [
    'case_id',
    'artifact_id',
    'startElementKey',
    'endElementKey',
    'relation',
    'strength',
    'description',
  ] as const;
  for (const k of fromRoot) {
    if (p[k] === undefined && r[k] !== undefined) p[k] = r[k];
  }
  return p;
}

/**
 * Preserve relationship authenticity:
 * - keep actual type/relation when present
 * - if missing, mark explicitly as UNSPECIFIED (not RELATED_TO)
 */
function readRelationType(r: Record<string, unknown>, flatRel?: Record<string, unknown>): string {
  const candidate =
    r.type ??
    r.relation ??
    flatRel?.relation ??
    flatRel?.type ??
    r.label ??
    (isRecord(r.properties) ? (r.properties.relation ?? r.properties.type) : undefined);
  const value = candidate != null ? String(candidate).trim() : '';
  return value || 'UNSPECIFIED';
}

function isLikelyNeoNode(n: Record<string, unknown>): boolean {
  const p = flattenNeoNode(n);
  return (
    Array.isArray(n.labels) ||
    typeof n.elementId === 'string' ||
    n.identity != null ||
    p.case_id != null ||
    p.elementKey != null ||
    p.artifact_id != null
  );
}

/** Stable id for a Neo4j-style node (elementId > elementKey > business id > internal identity). */
function neoNodeId(n: Record<string, unknown>, p: Record<string, unknown>, index: number): string {
  if (typeof n.elementId === 'string' && n.elementId.length > 0) return n.elementId;
  if (p.elementKey != null && String(p.elementKey).length > 0) return String(p.elementKey);
  if (p.id != null && String(p.id).length > 0) return String(p.id);
  if (n.identity != null) return `neo:${String(n.identity)}`;
  if (p.uuid != null) return String(p.uuid);
  if (p.entity_id != null) return String(p.entity_id);
  return `node_${index}`;
}

/**
 * Canonical numeric cluster id for the analytic graph (`RawEntity.community_id` / `GraphNode.community_id`).
 *
 * **Backend contract:** `communityId` is authoritative. `primaryCommunityId` and `community_id` are read only
 * as fallbacks for older payloads / denormalized copies.
 *
 * **Neo4j:** Members often carry `primaryCommunityId` while `(:Community { communityId })` holds the hub value;
 * when the subgraph includes `IN_COMMUNITY`, {@link applyInCommunityClusterResolution} fills missing `community_id`
 * on members from the linked `Community` node.
 */
export function readCanonicalClusterId(p: Record<string, unknown>): number | null {
  const raw = p.communityId ?? p.primaryCommunityId ?? p.community_id;
  if (raw == null) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return null;
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** `Community` meta-nodes from Neo4j normalize to this `EntityType` string via {@link asEntityType}. */
function isCommunityMetaNode(e: RawEntity): boolean {
  if (String(e.type) === 'community') return true;
  const labs = e.properties?.labels;
  if (Array.isArray(labs) && labs.some((x) => String(x) === 'Community')) return true;
  return false;
}

/**
 * When `IN_COMMUNITY` is present, set `community_id` on member entities that still lack a cluster
 * (from the linked `Community` node's `communityId`).
 */
function applyInCommunityClusterResolution(
  entities: RawEntity[],
  relationships: RawRelationship[]
): RawEntity[] {
  const list = entities.map((e) => ({ ...e }));
  const idToIdx = new Map<string, number>();
  list.forEach((e, i) => {
    if (e.id) idToIdx.set(e.id, i);
  });

  const communityNodeIds = new Set<string>();
  const clusterByCommunityNodeId = new Map<string, number>();
  for (const e of list) {
    if (!isCommunityMetaNode(e) || !e.id) continue;
    const cid = readCanonicalClusterId(e.properties ?? {});
    if (cid == null) continue;
    communityNodeIds.add(e.id);
    clusterByCommunityNodeId.set(e.id, cid);
  }

  for (const r of relationships) {
    if (String(r.relation ?? '').toUpperCase() !== 'IN_COMMUNITY') continue;
    const s = String(r.source);
    const t = String(r.target);
    let memberId: string | null = null;
    let hubId: string | null = null;
    if (communityNodeIds.has(s) && !communityNodeIds.has(t)) {
      hubId = s;
      memberId = t;
    } else if (communityNodeIds.has(t) && !communityNodeIds.has(s)) {
      hubId = t;
      memberId = s;
    } else {
      continue;
    }
    const cid = hubId ? clusterByCommunityNodeId.get(hubId) : undefined;
    if (cid == null || !memberId) continue;
    const idx = idToIdx.get(memberId);
    if (idx === undefined) continue;
    const ent = list[idx];
    if (ent.community_id == null) ent.community_id = cid;
  }

  return list;
}

/** Build `Community[]` summaries from per-entity `community_id` when the gateway omits `communities`. */
function synthesizeCommunitiesFromEntities(entities: RawEntity[]): Community[] {
  const byCluster = new Map<number, RawEntity[]>();
  for (const e of entities) {
    if (isCommunityMetaNode(e)) continue;
    if (e.community_id == null) continue;
    const arr = byCluster.get(e.community_id) ?? [];
    arr.push(e);
    byCluster.set(e.community_id, arr);
  }
  const out: Community[] = [];
  for (const [cid, members] of byCluster) {
    out.push({
      community_id: cid,
      level: 0,
      size: members.length,
      title: `Cluster ${cid}`,
      entity_names: members.map((m) => m.name),
      entity_ids: members.map((m) => m.id).filter((x): x is string => Boolean(x)),
    });
  }
  out.sort((a, b) => (a.community_id ?? 0) - (b.community_id ?? 0));
  return out;
}

function normalizeEntityCommunityId(e: RawEntity): RawEntity {
  const merged: Record<string, unknown> = { ...(e.properties ?? {}) };
  if (e.community_id != null) merged.community_id = e.community_id;
  const cid = readCanonicalClusterId(merged);
  return { ...e, community_id: cid };
}

/**
 * Convert Neo4j REST / subgraph-style payload into RawGraphData.
 */
function fromNeo4jStyle(obj: Record<string, unknown>, caseId: string): RawGraphData | null {
  const nodes = obj.nodes;
  const rels = Array.isArray(obj.relationships)
    ? obj.relationships
    : Array.isArray(obj.edges)
      ? obj.edges
      : [];
  if (!Array.isArray(nodes)) return null;
  if (nodes.length === 0 && rels.length === 0) return null;

  const first = nodes[0] as Record<string, unknown> | undefined;
  if (!first || !isLikelyNeoNode(first)) return null;

  const aliasToId = new Map<string, string>();

  const entities: RawEntity[] = (nodes as Record<string, unknown>[]).map((n, idx) => {
    const props = flattenNeoNode(n);
    const labels = (Array.isArray(n.labels) ? n.labels : []) as string[];
    const primary =
      labels[0] ||
      String(props.extractedEntityType ?? props.type ?? 'entity');
    const id = neoNodeId(n, props, idx);
    const nameRaw = props.name ?? props.title ?? props.label ?? props.elementKey ?? props.id ?? id;

    aliasToId.set(id, id);
    if (props.elementKey != null) aliasToId.set(String(props.elementKey), id);
    if (props.id != null) aliasToId.set(String(props.id), id);
    const nm = String(nameRaw);
    if (nm) aliasToId.set(nm, id);

    return {
      id,
      name: nm,
      type: asEntityType(primary),
      description: props.description != null ? String(props.description) : null,
      community_id: readCanonicalClusterId(props),
      case_id: String(props.case_id ?? caseId),
      artifact_id: String(props.artifact_id ?? props.file_id ?? ''),
      origin: String(props.origin ?? n.origin ?? 'neo4j'),
      /** `labels` helps {@link isCommunityMetaNode} when `type` alone is ambiguous. */
      properties: { ...props, labels },
    };
  });

  const idByIdentity = new Map<string, string>();
  (nodes as Record<string, unknown>[]).forEach((n, idx) => {
    const p = flattenNeoNode(n);
    const key = neoNodeId(n, p, idx);
    if (n.identity != null) idByIdentity.set(String(n.identity), key);
  });

  const relationships: RawRelationship[] = (rels as Record<string, unknown>[]).map((r, idx) => {
    const flatRel = flattenNeoRel(r);
    const relType = readRelationType(r, flatRel);
    let source = '';
    let target = '';
    if (typeof r.startNodeElementId === 'string' && typeof r.endNodeElementId === 'string') {
      source = r.startNodeElementId;
      target = r.endNodeElementId;
    } else if (
      typeof flatRel.startElementKey === 'string' &&
      typeof flatRel.endElementKey === 'string'
    ) {
      source = flatRel.startElementKey;
      target = flatRel.endElementKey;
    } else if (typeof r.source === 'string' && typeof r.target === 'string') {
      source = r.source;
      target = r.target;
    } else if (typeof r.start === 'string' && typeof r.end === 'string') {
      source = r.start;
      target = r.end;
    } else if (r.start != null && r.end != null) {
      const s = idByIdentity.get(String(r.start)) || `neo:${String(r.start)}`;
      const t = idByIdentity.get(String(r.end)) || `neo:${String(r.end)}`;
      source = s;
      target = t;
    }
    source = aliasToId.get(source) || source;
    target = aliasToId.get(target) || target;

    const rp = flatRel;
    return {
      id: typeof r.elementId === 'string' ? r.elementId : typeof r.id === 'string' ? r.id : `rel_${idx}`,
      source,
      target,
      relation: relType as RawRelationship['relation'],
      description: r.description != null ? String(r.description) : null,
      strength:
        typeof r.strength === 'number'
          ? r.strength
          : typeof rp.strength === 'number'
            ? rp.strength
            : typeof rp.weight === 'number'
              ? rp.weight
              : 5,
      case_id: String(rp.case_id ?? caseId),
      artifact_id: String(rp.artifact_id ?? ''),
      origin: String(rp.origin ?? r.origin ?? 'neo4j'),
      properties: isRecord(r.properties) ? r.properties : rp,
    };
  });

  return finalizeRaw(
    {
      entities,
      relationships,
      communities: (obj.communities as Community[]) || [],
      community_reports: mergeCommunityReportArrays(
        readConstructedCommunityReports(obj),
        (obj.community_reports as CommunityReport[]) || undefined
      ),
      stats: isRecord(obj.stats) ? (obj.stats as unknown as GraphStats) : undefined,
      extraction_meta: isRecord(obj.extraction_meta)
        ? (obj.extraction_meta as unknown as ExtractionMeta)
        : undefined,
    },
    caseId
  );
}

function finalizeRaw(
  partial: {
    entities: RawEntity[];
    relationships: RawRelationship[];
    communities?: Community[];
    community_reports?: CommunityReport[];
    stats?: GraphStats;
    extraction_meta?: ExtractionMeta;
  },
  caseId: string
): RawGraphData {
  const withCase: RawEntity[] = partial.entities.map((e) => ({
    ...e,
    case_id: e.case_id || caseId,
    artifact_id: e.artifact_id ?? '',
    origin: e.origin ?? 'gateway',
    description: e.description ?? null,
  }));
  const withCaseRels: RawRelationship[] = partial.relationships.map((r) => ({
    ...r,
    case_id: r.case_id || caseId,
    artifact_id: r.artifact_id ?? '',
    origin: r.origin ?? 'gateway',
    description: r.description ?? null,
    strength: typeof r.strength === 'number' ? r.strength : 5,
  }));

  const withCanonicalCluster = withCase.map(normalizeEntityCommunityId);
  const augmented = ensureEndpointsExist(withCanonicalCluster, withCaseRels, caseId);
  const clusterResolved = applyInCommunityClusterResolution(augmented, withCaseRels);

  let communities = partial.communities ?? [];
  if (!communities.length) {
    communities = synthesizeCommunitiesFromEntities(clusterResolved);
  }
  const community_reports = partial.community_reports ?? [];
  const stats =
    partial.stats ??
    defaultStats(
      clusterResolved.length,
      withCaseRels.length,
      communities.length,
      community_reports.length
    );

  const relationTypeCount = new Set(withCaseRels.map((r) => String(r.relation || 'RELATED_TO'))).size;
  console.info('[GraphPayload] finalizeRaw counts:', {
    entities: clusterResolved.length,
    relationships: withCaseRels.length,
    relationTypes: relationTypeCount,
    communities: communities.length,
  });

  return {
    entities: clusterResolved,
    relationships: withCaseRels,
    communities,
    community_reports,
    stats,
    extraction_meta: partial.extraction_meta ?? defaultExtractionMeta(),
  };
}

/** If relationships reference unknown node ids, add minimal placeholder entities */
function ensureEndpointsExist(
  entities: RawEntity[],
  relationships: RawRelationship[],
  caseId: string
): RawEntity[] {
  const known = new Set<string>();
  entities.forEach((e) => {
    if (e.id) known.add(e.id);
    if (e.name) known.add(e.name);
  });
  const placeholders: RawEntity[] = [];
  const addIfMissing = (id: string) => {
    if (!id || known.has(id)) return;
    known.add(id);
    placeholders.push({
      id,
      name: id,
      type: 'unknown',
      description: null,
      community_id: null,
      case_id: caseId,
      artifact_id: '',
      origin: 'inferred',
    });
  };
  for (const r of relationships) {
    addIfMissing(String(r.source));
    addIfMissing(String(r.target));
  }
  return [...entities, ...placeholders];
}

function coerceCanonical(obj: Record<string, unknown>, caseId: string): RawGraphData | null {
  if (!Array.isArray(obj.entities)) return null;
  const rels = Array.isArray(obj.relationships)
    ? obj.relationships
    : Array.isArray(obj.links)
      ? obj.links
      : Array.isArray(obj.edges)
        ? obj.edges
        : [];
  const rawRels = rels as Record<string, unknown>[];
  const relationships: RawRelationship[] = rawRels.map((r, idx) => ({
    id: (r.id as string) || `rel_${idx}`,
    source: String(
      r.source ?? r.from ?? r.startElementKey ?? r.start ?? ''
    ),
    target: String(r.target ?? r.to ?? r.endElementKey ?? r.end ?? ''),
    relation: readRelationType(r) as RawRelationship['relation'],
    description: (r.description as string) ?? null,
    strength: typeof r.strength === 'number' ? r.strength : 5,
    case_id: String(r.case_id ?? caseId),
    artifact_id: String(r.artifact_id ?? ''),
    origin: String(r.origin ?? 'gateway'),
    properties: isRecord(r.properties) ? r.properties : undefined,
  }));

  return finalizeRaw(
    {
      entities: obj.entities as RawEntity[],
      relationships,
      communities: (obj.communities as Community[]) || [],
      community_reports: mergeCommunityReportArrays(
        readConstructedCommunityReports(obj),
        (obj.community_reports as CommunityReport[]) || undefined
      ),
      stats: isRecord(obj.stats) ? (obj.stats as unknown as GraphStats) : undefined,
      extraction_meta: isRecord(obj.extraction_meta)
        ? (obj.extraction_meta as unknown as ExtractionMeta)
        : undefined,
    },
    caseId
  );
}

function extractFromCaseFiles(root: Record<string, unknown>, caseId: string): RawGraphData | null {
  const files = root.files;
  if (!Array.isArray(files)) return null;

  const bucket: { entities: RawEntity[]; relationships: RawRelationship[] } = {
    entities: [],
    relationships: [],
  };

  for (const file of files) {
    if (!isRecord(file)) continue;
    const tools = file.tools;
    if (!Array.isArray(tools)) continue;
    for (const tool of tools) {
      if (!isRecord(tool)) continue;
      const result = tool.result;
      if (!isRecord(result)) continue;

      const canon = coerceCanonical(result, caseId);
      if (canon) {
        bucket.entities.push(...canon.entities);
        bucket.relationships.push(...canon.relationships);
        continue;
      }
      const neo = fromNeo4jStyle(result, caseId);
      if (neo) {
        bucket.entities.push(...neo.entities);
        bucket.relationships.push(...neo.relationships);
      }
    }
  }

  if (bucket.entities.length === 0 && bucket.relationships.length === 0) return null;
  return finalizeRaw(bucket, caseId);
}

function graphSizeScore(g: RawGraphData | null): number {
  if (!g) return -1;
  return g.entities.length * 10 + g.relationships.length;
}

function parseMaybeJsonRecord(x: unknown): Record<string, unknown> | null {
  if (isRecord(x)) return x;
  if (typeof x !== 'string') return null;
  const t = x.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try {
    const parsed = JSON.parse(t);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function collectGraphCandidates(root: Record<string, unknown>, caseId: string): RawGraphData[] {
  const out: RawGraphData[] = [];
  const queue: unknown[] = [root];
  const seen = new Set<unknown>();
  let depth = 0;

  while (queue.length > 0 && depth < 6) {
    const batch = queue.splice(0, queue.length);
    for (const item of batch) {
      if (seen.has(item)) continue;
      seen.add(item);

      const rec = parseMaybeJsonRecord(item);
      if (!rec) continue;

      const c = coerceCanonical(rec, caseId) ?? fromNeo4jStyle(rec, caseId);
      if (c) out.push(c);

      for (const v of Object.values(rec)) {
        if (isRecord(v) || Array.isArray(v) || typeof v === 'string') {
          queue.push(v);
        }
      }
    }
    depth += 1;
  }

  return out;
}

/**
 * Normalize any import/detail JSON into RawGraphData for transformRawToGraphData.
 */
/**
 * Gateway plugin `plugin.graph_explorer.subgraph` returns `{ nodes: [{id,labels,props}], edges:[{id,source,target,type,props}] }`.
 * Maps into the same path as Neo4j driver nodes for `fromNeo4jStyle`.
 */
export function normalizeSubgraphPluginPayload(data: unknown, caseId: string): RawGraphData {
  if (!isRecord(data)) {
    return finalizeRaw({ entities: [], relationships: [] }, caseId);
  }
  const nodes = data.nodes;
  const edges = data.edges;
  if (!Array.isArray(nodes) || !Array.isArray(edges)) {
    return finalizeRaw({ entities: [], relationships: [] }, caseId);
  }

  const neoNodes = (nodes as Record<string, unknown>[]).map((n) => {
    const props = isRecord(n.props) ? { ...n.props } : {};
    const labels = (Array.isArray(n.labels) ? n.labels : []) as string[];
    const elementId = typeof n.id === 'string' ? n.id : undefined;
    return {
      labels,
      elementId,
      properties: props,
    };
  });

  const neoRels = (edges as Record<string, unknown>[]).map((e) => {
    const props = isRecord(e.props) ? { ...e.props } : {};
    return {
      type: e.type,
      elementId: e.id,
      startNodeElementId: typeof e.source === 'string' ? e.source : undefined,
      endNodeElementId: typeof e.target === 'string' ? e.target : undefined,
      properties: props,
    };
  });

  const graph = fromNeo4jStyle(
    {
      nodes: neoNodes as Record<string, unknown>[],
      relationships: neoRels as Record<string, unknown>[],
    },
    caseId
  );
  return graph ?? finalizeRaw({ entities: [], relationships: [] }, caseId);
}

/**
 * Normalize direct Neo4j export JSON (e.g., { nodes: [...], relationships: [...] }) into RawGraphData.
 * Used for file uploads or direct Neo4j exports that match the sample file structure.
 */
export function normalizeNeo4jExportPayload(data: unknown, caseId: string): RawGraphData {
  if (!isRecord(data)) {
    console.warn('[GraphPayload] Neo4j export payload is not an object');
    return finalizeRaw({ entities: [], relationships: [] }, caseId);
  }

  const graph = fromNeo4jStyle(data, caseId);
  if (graph) {
    console.info('[GraphPayload] Normalized Neo4j export:', {
      entities: graph.entities.length,
      relationships: graph.relationships.length,
    });
    return graph;
  }

  console.warn('[GraphPayload] Failed to normalize Neo4j export payload');
  return finalizeRaw({ entities: [], relationships: [] }, caseId);
}

/**
 * Normalize any import/detail JSON into RawGraphData for transformRawToGraphData.
 */
export function normalizeImportDetailGraphPayload(payload: unknown, caseId: string): RawGraphData {
  const payloadRoot: unknown =
    Array.isArray(payload) && payload.length > 0 && isRecord(payload[0]) ? payload[0] : payload;

  if (!isRecord(payloadRoot)) {
    console.warn('[GraphPayload] Expected object body from import/detail');
    return finalizeRaw({ entities: [], relationships: [] }, caseId);
  }

  const root = (isRecord(payloadRoot.rawdata) ? payloadRoot.rawdata : payloadRoot) as Record<string, unknown>;

  let best = coerceCanonical(root, caseId) ?? fromNeo4jStyle(root, caseId);

  // WHY many orchestrator responses wrap the real graph under channels.rawdata
  // (or sibling envelope fields), not at payload root.
  const channels = root.channels;
  if (isRecord(channels)) {
    const channelCandidates = ['rawdata', 'ui', 'data', 'neo4j', 'metadata'];
    for (const key of channelCandidates) {
      const inner = channels[key];
      const candidateObj = parseMaybeJsonRecord(inner);
      if (!candidateObj) continue;
      const c = coerceCanonical(candidateObj, caseId) ?? fromNeo4jStyle(candidateObj, caseId);
      if (graphSizeScore(c) > graphSizeScore(best)) best = c;
    }
  }

  // Some responses put a nested object at top-level `data`.
  const dataObj = parseMaybeJsonRecord(root.data);
  if (dataObj) {
    const fromData = coerceCanonical(dataObj, caseId) ?? fromNeo4jStyle(dataObj, caseId);
    if (graphSizeScore(fromData) > graphSizeScore(best)) best = fromData;
  }

  const nestedKeys = [
    'graph',
    'knowledge_graph',
    'neo4j_graph',
    'neo4j',
    'case_graph',
    'merged_graph',
    'subgraph',
    'cypher_result',
    'records',
  ];
  for (const key of nestedKeys) {
    const inner = parseMaybeJsonRecord(root[key]);
    if (!inner) continue;
    const c = coerceCanonical(inner, caseId) ?? fromNeo4jStyle(inner, caseId);
    if (graphSizeScore(c) > graphSizeScore(best)) best = c;
  }

  const fromFiles = extractFromCaseFiles(root, caseId);
  if (graphSizeScore(fromFiles) > graphSizeScore(best)) best = fromFiles;

  // Final safety net: deep-scan payload for embedded graph-like objects and keep
  // the richest candidate to avoid dropping large graphs hidden in envelopes.
  const deepCandidates = collectGraphCandidates(root, caseId);
  for (const c of deepCandidates) {
    if (graphSizeScore(c) > graphSizeScore(best)) best = c;
  }

  if (best) {
    const relationTypeCount = new Set(best.relationships.map((r) => String(r.relation || 'RELATED_TO'))).size;
    console.info('[GraphPayload] normalizeImportDetail selected candidate:', {
      entities: best.entities.length,
      relationships: best.relationships.length,
      relationTypes: relationTypeCount,
    });
    return best;
  }

  console.warn(
    '[GraphPayload] No entities/nodes found in import/detail — empty graph. Keys:',
    Object.keys(root).slice(0, 30)
  );
  return finalizeRaw({ entities: [], relationships: [] }, caseId);
}
