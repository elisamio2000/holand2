// ============================================
// One Search — backend capability gaps for footer handoff
// ============================================

import type { CapabilityGap } from '@/platform/dev-panels';
import type { OneSearchMode } from '@/types/one-search.types';

export type BackendGapPriority = 'P0' | 'P1' | 'P2';

export interface BackendCapabilityGap {
  id: string;
  capability: string;
  feWorkaround: string;
  requiredApi: string;
  /** Exact FE request shape sent today (or would send when BE ships). */
  feRequest: string;
  /** Expected BE response / behavior for acceptance. */
  expectedResponse: string;
  acceptance: string;
  priority: BackendGapPriority;
  modes: OneSearchMode[] | 'any';
  blockedFeatures: string[];
  /** Integration complete — remaining work is binding/infra only. */
  resolved?: boolean;
  resolvedNote?: string;
}

export const BACKEND_CAPABILITY_GAPS: BackendCapabilityGap[] = [
  {
    id: 'exclude-query-artifact',
    capability: 'Exclude query_image artifact from search hits',
    feWorkaround: 'Server excludes in orchestrator (B7); FE filter kept as belt-and-suspenders',
    requiredApi: 'Automatic when query_image set (no arg required)',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "image", "query_image": { "artifact_id": "abc-123" }, "top_k": 15 } }`,
    expectedResponse: `lanes[].hits[] must NOT contain artifact_id "abc-123" in meta; total excludes self-match`,
    acceptance:
      'When query_image is set, response lanes never include the query artifact_id (even at score 1.0)',
    priority: 'P1',
    modes: ['image', 'all'],
    blockedFeatures: ['Clean visual results without self-match at rank #1'],
    resolved: true,
    resolvedNote: 'plugin_smart_search orchestrator exclude_artifact_hits (2026-06)',
  },
  {
    id: 'ephemeral-visual-upload',
    capability: 'Ephemeral visual query upload (no permanent catalog)',
    feWorkaround: 'POST /upload then batch delete; prefer POST /storage/temp-upload when available',
    requiredApi: 'POST /storage/temp-upload?purpose=visual_search&ttl=24h',
    feRequest: `POST /storage/temp-upload
Content-Type: multipart/form-data
{ file, purpose: "visual_search", ttl_hours: 24 }`,
    expectedResponse: `{ "artifact_id": "tmp-uuid", "expires_at": "ISO8601", "listed_in_catalog": false }`,
    acceptance:
      'Upload returns artifact usable as query_image; not listed in file_manager; auto-purged after TTL',
    priority: 'P1',
    modes: ['image', 'all'],
    blockedFeatures: ['Clean storage catalog', 'No DB pollution from search uploads'],
    resolved: true,
    resolvedNote: 'POST /storage/temp-upload + ephemeral columns (2026-07)',
  },
  {
    id: 'visual-similarity-binding',
    capability: 'Visual similarity (DINOv2 / image_by_example)',
    feWorkaround: 'Shows degraded banner when notes contain no_visual_matches; metadata fallback hits',
    requiredApi: 'PUT /admin/tools/plugin_smart_search/binding + embedding index',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "image", "query_image": { "artifact_id": "img-1", "crop": { "x": 10, "y": 20, "width": 40, "height": 30 } }, "top_k": 15 } }`,
    expectedResponse: `{ "lanes": [{ "lane": "storage", "hits": [{ "meta": { "match": "visual", "score": 0.87 } }] }], "metadata": { "notes": [] } }`,
    acceptance:
      'Visual upload returns meta.match=visual with score > threshold; no_visual_matches absent when index ready',
    priority: 'P0',
    modes: ['image', 'all'],
    blockedFeatures: ['True Lens similar images', 'Reliable visual ranking'],
  },
  {
    id: 'semantic-text-binding',
    capability: 'Semantic text search',
    feWorkaround: 'Degraded sources panel; filename/metadata hits only',
    requiredApi: 'LLM binding for plugin_smart_search_text',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "text", "query": "quarterly revenue report", "top_k": 15 } }`,
    expectedResponse: `{ "lanes": [{ "lane": "files", "hits": [{ "meta": { "match": "semantic" } }] }], "metadata": { "notes": [] } }`,
    acceptance: 'metadata.notes no longer reports binding_not_configured for text lane',
    priority: 'P0',
    modes: ['text', 'all'],
    blockedFeatures: ['Semantic ranking in text/all modes'],
  },
  {
    id: 'server-sort',
    capability: 'Server-side sort (date, size, relevance)',
    feWorkaround: 'args.sort forwarded; orchestrator sort_hits per lane',
    requiredApi: 'args.sort: relevance|date_desc|date_asc|score_desc',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "all", "query": "report", "sort": "date_desc", "top_k": 15 } }`,
    expectedResponse: `hits ordered by occurred_at descending server-side; stable across pagination`,
    acceptance: 'Response order matches sort without client reorder',
    priority: 'P1',
    modes: ['image', 'video', 'audio', 'file', 'all'],
    blockedFeatures: ['Correct pagination with sort'],
    resolved: true,
    resolvedNote: 'finalize_lane_hits + sort_hits in plugin_smart_search',
  },
  {
    id: 'server-facets',
    capability: 'Facet filters (MIME, date, file type, lane)',
    feWorkaround: 'args.filters honored server-side; full response.facets.byFileType still client-derived',
    requiredApi: 'args.filters + response.facets.byFileType / byDate / byLane',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "all", "query": "report", "filters": { "lanes": ["files"], "fileTypes": ["pdf"], "dateFrom": "2025-01-01" }, "top_k": 15 } }`,
    expectedResponse: `{ "total": 42, "facets": { "byLane": { "files": 42 }, "byFileType": { "pdf": 42 } }, "lanes": [...] }`,
    acceptance: 'Filter reduces total server-side; facets reflect full index',
    priority: 'P1',
    modes: ['image', 'video', 'audio', 'file', 'all'],
    blockedFeatures: ['Filter beyond loaded hits', 'Aggregate facet counts from full index'],
    resolved: true,
    resolvedNote: 'Partial — apply_hit_filters + filter_lane_ids; aggregate facets still missing',
  },
  {
    id: 'pagination',
    capability: 'Server pagination',
    feWorkaround: 'args.pagination forwarded; paginate_hits per lane',
    requiredApi: 'args.pagination.offset/limit + stable total',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "image", "query": "photo", "pagination": { "offset": 24, "limit": 24 } } }`,
    expectedResponse: `{ "total": 120, "lanes": [{ "hits": [/* next 24 */], "total": 120 }] }`,
    acceptance: 'Page 2 fetch returns next hits without duplicates',
    priority: 'P1',
    modes: 'any',
    blockedFeatures: ['Large result sets', 'Infinite scroll'],
    resolved: true,
    resolvedNote: 'paginate_hits in plugin_smart_search orchestrator',
  },
  {
    id: 'related-searches',
    capability: 'Related searches / PAA',
    feWorkaround: 'channels.llm summary or mock PAA in non-live mode',
    requiredApi: 'response.suggestions.relatedSearches[]',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "text", "query": "kubernetes deployment", "top_k": 15 } }`,
    expectedResponse: `{ "suggestions": { "relatedSearches": ["k8s rollout strategy", "helm chart deploy"] } }`,
    acceptance: 'Non-empty relatedSearches for text queries',
    priority: 'P2',
    modes: ['all', 'text'],
    blockedFeatures: ['Related searches panel (live)'],
  },
  {
    id: 'voice-search',
    capability: 'Voice input search',
    feWorkaround: 'MediaRecorder → POST /search/stt; Web Speech API fallback when STT unavailable',
    requiredApi: 'POST /search/stt',
    feRequest: `POST /search/stt (multipart)
audio: webm binary, language: fa|en|auto, max_duration_sec: 30`,
    expectedResponse: `{ "transcript": "budget meeting", "confidence": 0.94, "language": "fa" } → FE submits mode=audio&q=...`,
    acceptance: 'Voice query triggers search with transcript text',
    priority: 'P2',
    modes: ['audio', 'all'],
    blockedFeatures: ['Reliable server-side STT without browser fallback'],
    resolved: true,
    resolvedNote: 'POST /search/stt → llm-proxy ASR (503 when unbound)',
  },
  {
    id: 'video-audio-transcript',
    capability: 'Video/audio transcript search index',
    feWorkaround: 'Filename/metadata hits only in video/audio modes',
    requiredApi: 'Transcript text index bound to plugin_smart_search',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "video", "query": "budget meeting", "top_k": 15 } }`,
    expectedResponse: `{ "lanes": [{ "lane": "storage", "hits": [{ "meta": { "match": "transcript", "snippet": "...budget meeting..." } }] }] }`,
    acceptance: 'Transcript matches rank above filename-only hits for spoken content queries',
    priority: 'P1',
    modes: ['video', 'audio'],
    blockedFeatures: ['Search inside media transcripts', 'Timestamp jump to match'],
  },
  {
    id: 'audio-duration-metadata',
    capability: 'Audio duration + format metadata in search hits',
    feWorkaround: 'Client shows 0:00 until WaveSurfer decodes; MIME inferred from filename extension',
    requiredApi: 'hit.meta.duration (seconds), hit.meta.mime from artifact record',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "audio", "query": "meeting", "top_k": 15 } }`,
    expectedResponse: `{ "lanes": [{ "hits": [{ "meta": { "artifact_id": "uuid", "mime": "audio/wav", "duration": 183.4, "size_bytes": 334848 } }] }] }`,
    acceptance: 'Audio cards show duration before playback; toolbar sort by size uses accurate size_bytes',
    priority: 'P1',
    modes: ['audio'],
    blockedFeatures: ['Duration badge before play', 'Sort by duration'],
  },
  {
    id: 'audio-waveform-peaks',
    capability: 'Precomputed waveform peaks for search results',
    feWorkaround: 'WaveSurfer decodes full file client-side (slow for long audio)',
    requiredApi: 'GET /storage/files/{id}/waveform-peaks or meta.waveform_peaks[] in hit',
    feRequest: `GET /storage/files/{artifact_id}/waveform-peaks?bins=128`,
    expectedResponse: `{ "peaks": [0.1, 0.4, ...], "duration": 183.4 }`,
    acceptance: 'Mini waveform renders without full decode; faster grid scroll',
    priority: 'P2',
    modes: ['audio'],
    blockedFeatures: ['Instant mini waveforms', 'Low-bandwidth audio grid'],
    resolved: true,
    resolvedNote: 'GET /storage/files/{id}/waveform-peaks — empty peaks when not indexed',
  },
  {
    id: 'audio-transcript-jump',
    capability: 'Transcript match timestamps (seek to spoken word)',
    feWorkaround: 'FE seek when meta.transcript_match present; else opens TranscriptPanel (404 degraded)',
    requiredApi: 'hit.meta.transcript_match: { start_sec, end_sec, text }',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "mode": "audio", "query": "budget", "top_k": 15 } }`,
    expectedResponse: `{ "hits": [{ "meta": { "match": "transcript", "transcript_match": { "start_sec": 42.1, "end_sec": 45.0 } }, "snippet": "...budget..." }] }`,
    acceptance: 'Click snippet seeks player to start_sec; highlight region on waveform',
    priority: 'P1',
    modes: ['audio', 'video'],
    blockedFeatures: ['Jump to spoken match', 'Highlighted transcript regions'],
  },
  {
    id: 'artifact-transcript-get',
    capability: 'Full transcript document for media panel',
    feWorkaround: 'TranscriptPanel → storageService.fetchArtifactTranscript; 404 shows degraded hint',
    requiredApi: 'GET /storage/files/{artifact_id}/transcript',
    feRequest: `GET /storage/files/{artifact_id}/transcript
Authorization: Bearer <token>`,
    expectedResponse: `{ "artifact_id": "uuid", "language": "fa", "segments": [{ "start_sec": 0, "end_sec": 4.2, "text": "..." }], "full_text": "..." }`,
    acceptance: 'TranscriptPanel lists segments; click seeks player',
    priority: 'P1',
    modes: ['audio', 'video'],
    blockedFeatures: ['Full transcript side panel without mock'],
    resolved: true,
    resolvedNote: 'GET /storage/files/{id}/transcript gateway proxy (2026-07)',
  },
  {
    id: 'minio-cors-presigned',
    capability: 'MinIO CORS for presigned direct media URLs',
    feWorkaround: 'blob-first JWT fetch for audio; presigned-first for video with blob fallback',
    requiredApi: 'MinIO bucket CORS allowing browser Origin + Range headers',
    feRequest: `GET {presigned.url} with Origin: http://localhost:3002, Range: bytes=0-`,
    expectedResponse: `200/206 with Access-Control-Allow-Origin; WaveSurfer can decode cross-origin when needed`,
    acceptance: 'Presigned URLs work in WaveSurfer without blob fallback for files under ~10MB',
    priority: 'P2',
    modes: ['audio', 'video'],
    blockedFeatures: ['Streaming without full download', 'Lower memory for long audio'],
  },
  {
    id: 'video-player-artifact-metadata',
    capability: 'Video artifact media metadata (duration, resolution)',
    feWorkaround: 'Wait for loadedmetadata or search hit meta hints',
    requiredApi: 'GET /storage/artifacts/{id} with media.duration_sec, width, height',
    feRequest: `GET /storage/artifacts/{artifact_id}`,
    expectedResponse: `{ "media": { "duration_sec": 95.2, "width": 1920, "height": 1080 } }`,
    acceptance: 'Modal header and time display correct before video loads',
    priority: 'P0',
    modes: ['video'],
    blockedFeatures: ['Accurate duration/resolution in player chrome'],
    resolved: true,
    resolvedNote: 'GET /storage/artifacts/{id} enriched with media block',
  },
  {
    id: 'video-player-chapters',
    capability: 'Video chapter markers',
    feWorkaround: 'Advanced mode hides chapters tab when GET /chapters returns 404',
    requiredApi: 'GET /storage/files/{artifact_id}/chapters',
    feRequest: `GET /storage/files/{artifact_id}/chapters`,
    expectedResponse: `{ "chapters": [{ "id": "1", "title": "Intro", "start_sec": 0, "end_sec": 18 }] }`,
    acceptance: 'Progress bar chapter dots + sidebar chapter list',
    priority: 'P2',
    modes: ['video'],
    blockedFeatures: ['Advanced chapters panel with real data'],
    resolved: true,
    resolvedNote: 'GET /storage/files/{id}/chapters — empty until indexed',
  },
  {
    id: 'video-player-subtitles',
    capability: 'VTT subtitle tracks',
    feWorkaround: 'CC toggle hidden when no tracks; onSubtitlesLoad returns [] on 404',
    requiredApi: 'GET /storage/files/{artifact_id}/subtitles + GET .../subtitles/{lang}.vtt',
    feRequest: `GET /storage/files/{artifact_id}/subtitles`,
    expectedResponse: `{ "tracks": [{ "id": "en", "label": "English", "url": ".../en.vtt" }] }`,
    acceptance: 'Settings subtitles list + CC overlay',
    priority: 'P2',
    modes: ['video'],
    blockedFeatures: ['Captions in player'],
    resolved: true,
    resolvedNote: 'GET /storage/files/{id}/subtitles — empty until indexed',
  },
  {
    id: 'video-player-filmstrip',
    capability: 'Filmstrip sprite sheet for advanced timeline',
    feWorkaround: 'Offscreen hidden video sampler in filmstrip-timeline.tsx (no main playback interrupt); BE sprite when available',
    requiredApi: 'GET /storage/files/{artifact_id}/filmstrip?interval_sec=10&width=160',
    feRequest: `GET /storage/files/{artifact_id}/filmstrip?interval_sec=10&width=160`,
    expectedResponse: `{ "sprite_url": "...", "tile_width": 160, "tile_count": 20, "duration_sec": 200 }`,
    acceptance: 'Advanced filmstrip without per-frame decode hitch',
    priority: 'P2',
    modes: ['video'],
    blockedFeatures: ['Performant advanced timeline on 10min+ files'],
    resolved: true,
    resolvedNote: 'GET /storage/files/{id}/filmstrip — 404 until sprite generated',
  },
  {
    id: 'search-metrics',
    capability: 'Admin search metrics',
    feWorkaround: 'one-search-activity widget uses mock data',
    requiredApi: 'GET /search/metrics',
    feRequest: `GET /search/metrics?window=24h`,
    expectedResponse: `{ "query_count": 1204, "p50_ms": 340, "p95_ms": 890, "by_mode": { "text": 800 } }`,
    acceptance: 'Widget shows live query volume and latency percentiles',
    priority: 'P2',
    modes: 'any',
    blockedFeatures: ['Admin dashboard live metrics'],
    resolved: true,
    resolvedNote: 'GET /search/metrics from search_query_log',
  },
  {
    id: 'rest-federated',
    capability: 'REST federated search',
    feWorkaround: 'POST /tools/plugin_smart_search/execute or POST /search/query',
    requiredApi: 'POST /search/query → OneSearchResponse',
    feRequest: `POST /search/query
{ "query": "report", "mode": "all", "top_k": 15, "filters": {}, "pagination": { "offset": 0, "limit": 15 } }`,
    expectedResponse: `OneSearchResponse JSON (lanes, facets, suggestions) without tool envelope`,
    acceptance: 'gateway-query provider works without tool execute envelope',
    priority: 'P1',
    modes: 'any',
    blockedFeatures: ['Simpler client', 'Standard REST caching'],
    resolved: true,
    resolvedNote: 'POST /search/query + gateway-query provider (2026-07)',
  },
  {
    id: 'session-context',
    capability: 'Session-scoped search context',
    feWorkaround: 'Not sent',
    requiredApi: 'args.session_id',
    feRequest: `POST /tools/plugin_smart_search/execute
{ "args": { "query": "follow up", "session_id": "sess-uuid", "top_k": 15 } }`,
    expectedResponse: `Follow-up results biased by prior queries in same session_id`,
    acceptance: 'Follow-up queries use prior context when session_id set',
    priority: 'P2',
    modes: 'any',
    blockedFeatures: ['Conversational search refinement'],
  },
];

export function capabilityGapsForMode(mode: OneSearchMode): BackendCapabilityGap[] {
  return BACKEND_CAPABILITY_GAPS.filter(
    (g) => g.modes === 'any' || g.modes.includes(mode)
  );
}

function gapUiSurface(gap: BackendCapabilityGap, activeMode: OneSearchMode): string {
  if (gap.modes === 'any') return 'shared';
  if (gap.modes.includes(activeMode)) return activeMode;
  return gap.modes[0] ?? activeMode;
}

/** Map One Search gaps to platform CapabilityGapsTable rows for the active mode tab. */
export function capabilityGapsForDevPanel(mode: OneSearchMode): CapabilityGap[] {
  return capabilityGapsForMode(mode).map((gap) => ({
    id: gap.id,
    capability: gap.capability,
    feWorkaround: gap.feWorkaround,
    requiredApi: gap.requiredApi,
    feRequest: gap.feRequest,
    expectedResponse: gap.expectedResponse,
    acceptance: gap.acceptance,
    priority: gap.priority,
    uiSurface: gapUiSurface(gap, mode),
    resolved: gap.resolved,
    resolvedNote: gap.resolvedNote,
  }));
}

/** i18n key suffix under searchHub.devRequirements.gaps.{id} */
export function oneSearchGapI18nKey(id: string): string {
  return `searchHub.devRequirements.gaps.${id}`;
}
