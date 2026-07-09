// ============================================
// One Search — shared types (frontend ↔ gateway contract)
// ============================================

/** High-level modality for routing a query to indexers. */
export type OneSearchMode = 'all' | 'text' | 'image' | 'audio' | 'video' | 'file';

/** Logical buckets shown as separate lanes in the federated UI. */
export type OneSearchLaneId =
  | 'chat'
  | 'cases'
  | 'files'
  | 'storage'
  | 'users'
  | 'graph'
  | 'projects_tasks';

/** Single hit inside a lane (minimal shape for cards/snippets). */
export interface OneSearchHit {
  id: string;
  title: string;
  snippet?: string;
  href?: string;
  score?: number;
  /** ISO-8601 or epoch string from gateway */
  occurredAt?: string;
  /** Free-form metadata for badges (mime, case_id, session_id, thumb_url, …) */
  meta?: Record<string, any>;
}

export interface OneSearchLaneResult {
  lane: OneSearchLaneId;
  total?: number;
  hits: OneSearchHit[];
}

/** Facets for filters sidebar */
export interface OneSearchFacets {
  byLane?: Record<OneSearchLaneId, number>;
  byDate?: Record<string, number>;
  byFileType?: Record<string, number>;
  scriptVariants?: string[];
  relatedEntities?: string[];
}

/** Suggestions for query refinement */
export interface OneSearchSuggestions {
  didYouMean?: string;
  relatedSearches?: string[];
}

/** Image sample for visual search (Lens crop / upload). */
export interface OneSearchQueryImage {
  artifact_id: string;
  path?: string;
  crop?: { x: number; y: number; width: number; height: number };
  /** User drag/upload in this session — eligible for ephemeral cleanup (never in URL). */
  ephemeral?: boolean;
}

export type OneSearchKind = 'text' | 'visual' | 'hybrid';

/** Expected envelope for `POST /search/query` */
export interface OneSearchResponse {
  query: string;
  mode: OneSearchMode;
  tookMs?: number;
  total?: number;
  lanes: OneSearchLaneResult[];
  facets?: OneSearchFacets;
  suggestions?: OneSearchSuggestions;
  searchKind?: OneSearchKind;
}

/** Request body for search API */
export interface OneSearchRequest {
  query: string;
  mode?: OneSearchMode;
  /** Visual search sample — one of query or queryImage required for smart_search. */
  queryImage?: OneSearchQueryImage;
  /** Maps to smart_search `score_threshold` when set. */
  scoreThreshold?: number;
  filters?: {
    lanes?: OneSearchLaneId[];
    dateFrom?: string;
    dateTo?: string;
    fileTypes?: string[];
    languages?: string[];
  };
  /** Audio/video toolbar filters (forward-compatible with smart_search). */
  mediaFilters?: {
    mimeTypes?: string[];
    durationMinSec?: number;
    durationMaxSec?: number;
    hasTranscript?: boolean;
    matchKinds?: string[];
    uploadedBy?: string;
    dateRange?: string;
    minSizeBytes?: number;
    maxSizeBytes?: number;
  };
  pagination?: {
    offset?: number;
    limit?: number;
  };
  sort?:
    | 'relevance'
    | 'date_desc'
    | 'date_asc'
    | 'size_desc'
    | 'size_asc'
    | 'duration_desc'
    | 'duration_asc';
  /** Authenticated user id for memory search and other user-scoped lanes */
  userId?: string;
  /** Abort in-flight provider calls when the hook unmounts or query changes. */
  signal?: AbortSignal;
}

/** Active search backend strategy (env-driven). */
export type OneSearchProviderId =
  | 'mock'
  | 'temp-federated'
  | 'smart-search'
  | 'gateway-query';

/** Per-lane data source override. */
export type OneSearchLaneSourceMode = 'real' | 'mock' | 'off';

/** Runtime status of a single upstream API call. */
export type OneSearchSourceStatus =
  | 'ok'
  | 'error'
  | 'skipped'
  | 'mock'
  | 'timeout';

/** One row in the API footprint footer (static requirement or live call). */
export type OneSearchRequirementStatus =
  | 'live'
  | 'resolved'
  | 'workaround'
  | 'binding'
  | 'missing'
  | 'optional';

export interface OneSearchDataSourceDescriptor {
  mode: OneSearchMode | 'any';
  lane: OneSearchLaneId | 'any';
  toolId: string;
  endpoint: string;
  targetApi: string;
  notes?: string;
  /** Handoff status — binding = only model/tool binding remains. */
  requirementStatus?: OneSearchRequirementStatus;
}

/** Live record of an upstream call for the current query. */
export interface OneSearchDataSourceCall extends OneSearchDataSourceDescriptor {
  args?: Record<string, unknown>;
  status: OneSearchSourceStatus;
  latencyMs?: number;
  error?: string;
  hitCount?: number;
}

/** Metadata returned alongside search results for transparency / handoff. */
export interface OneSearchExecutionMeta {
  providerId: OneSearchProviderId;
  query: string;
  mode: OneSearchMode;
  tookMs: number;
  calls: OneSearchDataSourceCall[];
  hasMockLanes: boolean;
  hasRealLanes: boolean;
  /** Primary upstream endpoint when using smart-search provider. */
  primaryEndpoint?: string;
  /** Per-source degradation notes from plugin_smart_search metadata.notes. */
  degradedSources?: Record<string, string>;
  /** Echo from smart_search payload: text | visual | hybrid. */
  searchKind?: OneSearchKind;
  /** Human-readable summary from result.channels.llm. */
  aiSummary?: string;
  /** Echo of metadata.query_image.artifact_id from smart_search. */
  queryImageEcho?: string;
  /** True when smart_search fell back to temp-federated lanes. */
  usedTempFederatedFallback?: boolean;
  /** Set when the primary call was rate-limited (429). */
  rateLimited?: boolean;
}

export interface OneSearchResult {
  response: OneSearchResponse;
  meta: OneSearchExecutionMeta;
}
