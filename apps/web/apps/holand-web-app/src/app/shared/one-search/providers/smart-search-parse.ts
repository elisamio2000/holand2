// ============================================
// One Search — parse plugin_smart_search gateway response
// ============================================

import type {
  OneSearchKind,
  OneSearchLaneId,
  OneSearchLaneResult,
  OneSearchRequest,
  OneSearchResponse,
} from '@/types/one-search.types';
import {
  extractQueryImageEcho,
  extractToolLlmSummary,
  extractToolMetadataNotes,
  unwrapToolExecuteData,
} from '@/utils/tool-execute';
import { getOneSearchVisibleLaneIds } from '../config/search-config';
import { emptyLaneResults, filterResponseByMode } from '../utils/filter-response-by-mode';

export const SS_TOOL = 'plugin.smart_search';
export const SS_ENDPOINT = '/tools/plugin_smart_search/execute';
export const SS_TARGET_API = 'POST /tools/plugin_smart_search/execute';

const LANE_IDS: OneSearchLaneId[] = getOneSearchVisibleLaneIds('smart-search');

export interface SmartSearchParseResult {
  response: OneSearchResponse;
  degradedSources?: Record<string, string>;
  searchKind?: OneSearchKind;
  /** Human-readable summary from result.channels.llm */
  aiSummary?: string;
  /** Echo of query_image.artifact_id from metadata */
  queryImageEcho?: string;
}

function laneCountsFromMetadata(
  metadata: unknown
): Partial<Record<OneSearchLaneId, number>> | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const byLane = (metadata as Record<string, unknown>).byLane;
  if (!byLane || typeof byLane !== 'object') return undefined;
  return byLane as Partial<Record<OneSearchLaneId, number>>;
}

function parseSearchKind(data: Record<string, unknown>): OneSearchKind | undefined {
  const raw = data.search_kind;
  if (raw === 'text' || raw === 'visual' || raw === 'hybrid') return raw;
  return undefined;
}

function parseLaneRows(lanesRaw: unknown): OneSearchLaneResult[] {
  if (!Array.isArray(lanesRaw)) return [];

  return lanesRaw
    .map((laneRow) => {
      if (!laneRow || typeof laneRow !== 'object') return null;
      const row = laneRow as Record<string, unknown>;
      const lane = row.lane as OneSearchLaneId;
      if (!LANE_IDS.includes(lane)) return null;
      const hits = Array.isArray(row.hits) ? row.hits : [];
      return {
        lane,
        total: typeof row.total === 'number' ? row.total : hits.length,
        hits: hits as OneSearchLaneResult['hits'],
      };
    })
    .filter((row) => row !== null) as OneSearchLaneResult[];
}

function buildEmptyResponse(request: OneSearchRequest): OneSearchResponse {
  const mode = request.mode ?? 'all';
  const query = request.query.trim();
  const lanes = emptyLaneResults('smart-search');
  return {
    query,
    mode,
    total: 0,
    lanes,
    facets: {
      byLane: Object.fromEntries(lanes.map((l) => [l.lane, 0])) as Record<
        OneSearchLaneId,
        number
      >,
    },
  };
}

/** Parse gateway tool execute envelope into OneSearchResponse. */
export function parseSmartSearchResponse(
  raw: unknown,
  request: OneSearchRequest,
  options?: { trustServerMode?: boolean }
): SmartSearchParseResult | null {
  const data = unwrapToolExecuteData<Record<string, unknown>>(raw);
  if (!data) return null;

  const searchKind = parseSearchKind(data);
  const aiSummary = extractToolLlmSummary(raw);
  const queryImageEcho = extractQueryImageEcho(data);
  const degradedSources = extractToolMetadataNotes(data);
  const lanes = parseLaneRows(data.lanes);

  if (lanes.length === 0) {
    return {
      response: buildEmptyResponse(request),
      degradedSources,
      searchKind,
      aiSummary,
      queryImageEcho,
    };
  }

  const mode = request.mode ?? 'all';
  const query = request.query.trim();
  const tookMs = typeof data.tookMs === 'number' ? data.tookMs : undefined;
  const total =
    typeof data.total === 'number'
      ? data.total
      : lanes.reduce((sum, lane) => sum + lane.hits.length, 0);

  const metadataByLane = laneCountsFromMetadata(data.metadata);
  const computedByLane = Object.fromEntries(
    lanes.map((l) => [l.lane, l.total ?? l.hits.length])
  ) as Partial<Record<OneSearchLaneId, number>>;
  const byLane = {
    chat: 0,
    cases: 0,
    files: 0,
    storage: 0,
    graph: 0,
    users: 0,
    projects_tasks: 0,
    ...metadataByLane,
    ...computedByLane,
  } satisfies Record<OneSearchLaneId, number>;

  const response = filterResponseByMode(
    {
      query,
      mode,
      tookMs,
      total,
      lanes,
      facets: { byLane },
      searchKind,
    },
    mode,
    { trustServerMode: options?.trustServerMode ?? true }
  );

  return {
    response,
    degradedSources,
    searchKind,
    aiSummary,
    queryImageEcho,
  };
}
