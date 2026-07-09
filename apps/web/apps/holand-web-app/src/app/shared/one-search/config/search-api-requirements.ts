// ============================================
// Static API requirement matrix for backend handoff
// ============================================

import type {
  OneSearchDataSourceDescriptor,
  OneSearchLaneId,
  OneSearchMode,
  OneSearchRequirementStatus,
} from '@/types/one-search.types';

const TARGET = 'POST /search/query (federated lanes)';
const SMART_SEARCH = 'POST /tools/plugin_smart_search/execute';

function req(
  mode: OneSearchMode | 'any',
  lane: OneSearchLaneId | 'any',
  toolId: string,
  endpoint: string,
  notes?: string,
  targetApi: string = TARGET,
  requirementStatus: OneSearchRequirementStatus = 'live'
): OneSearchDataSourceDescriptor {
  return { mode, lane, toolId, endpoint, targetApi, notes, requirementStatus };
}

/** Requirements shown in the footer for every mode (backend contract reference). */
export const ONE_SEARCH_API_REQUIREMENTS: OneSearchDataSourceDescriptor[] = [
  req(
    'any',
    'any',
    'plugin.smart_search',
    SMART_SEARCH,
    'Primary One Search API — RRF fusion, filters/sort/pagination, query_image metadata echo',
    SMART_SEARCH,
    'live'
  ),
  req('all', 'chat', 'plugin.smart_search_messenger', SMART_SEARCH, 'Chat lane (internal sub-tool)', SMART_SEARCH, 'live'),
  req('all', 'cases', 'plugin.smart_search_cases', SMART_SEARCH, 'Cases lane — user_id forwarded for RBAC', SMART_SEARCH, 'resolved'),
  req('all', 'files', 'plugin.smart_search_artifacts', SMART_SEARCH, 'Files lane metadata', SMART_SEARCH, 'live'),
  req('all', 'storage', 'plugin.smart_search_artifacts', SMART_SEARCH, 'Storage/media metadata lane', SMART_SEARCH, 'live'),
  req('all', 'graph', 'plugin.smart_search_graph', SMART_SEARCH, 'Graph lane (internal sub-tool)', SMART_SEARCH, 'live'),
  req('all', 'users', 'plugin.smart_search_users', SMART_SEARCH, 'Users lane — Storage /users search', SMART_SEARCH, 'live'),
  req(
    'all',
    'files',
    'plugin.smart_search_text',
    SMART_SEARCH,
    'Semantic text index — requires embed_text binding',
    SMART_SEARCH,
    'binding'
  ),
  req(
    'image',
    'storage',
    'plugin.smart_search_image_by_example',
    SMART_SEARCH,
    'Visual Lens — wired; needs image_search (DINOv2) binding + index',
    SMART_SEARCH,
    'binding'
  ),
  req(
    'all',
    'storage',
    'plugin.smart_search_image_clip',
    SMART_SEARCH,
    'Image-by-description (SigLIP) — optional; needs embed_imagetext binding',
    SMART_SEARCH,
    'binding'
  ),
  req('all', 'chat', 'plugin.user_mail.search', 'POST /tools/plugin_user_mail_search/execute', 'Legacy fallback when SMART_FALLBACK≠off', TARGET, 'optional'),
  req('all', 'chat', 'plugin.memory.search', 'POST /memory/search', 'Legacy fallback chat memory supplement', TARGET, 'optional'),
  req('all', 'users', 'admin.users.list', 'GET /admin/users', 'Legacy fallback — client-side name/email filter', TARGET, 'optional'),
  req('all', 'cases', 'plugin.graph_explorer.cases', 'POST /tools/plugin_graph_explorer_cases/execute', 'Legacy fallback', TARGET, 'optional'),
  req('all', 'files', 'plugin.file_manager.list', 'POST /tools/plugin_file_manager_list/execute', 'Supplement when smart_search lanes sparse', TARGET, 'optional'),
  req('all', 'graph', 'plugin.graph_explorer.graph_search', 'POST /tools/plugin_graph_explorer_graph_search/execute', 'Legacy fallback', TARGET, 'optional'),
  req('text', 'chat', 'plugin.smart_search', SMART_SEARCH, 'mode=text — transcript hits merged into files lane', SMART_SEARCH, 'resolved'),
  req('image', 'storage', 'plugin.smart_search', SMART_SEARCH, 'mode=image — visual + metadata storage', SMART_SEARCH, 'live'),
  req('audio', 'storage', 'plugin.smart_search', SMART_SEARCH, 'mode=audio — transcript index when text_search bound', SMART_SEARCH, 'binding'),
  req('video', 'storage', 'plugin.smart_search', SMART_SEARCH, 'mode=video — transcript index when text_search bound', SMART_SEARCH, 'binding'),
  req(
    'audio',
    'storage',
    'storage.artifact_download',
    'GET /storage/artifacts/{id}/download?mode=inline',
    'JWT blob fetch → blob: URL for WaveSurfer (resolveStoragePlaybackUrl, blob-first)',
    'GET /storage/artifacts/{id}/download?mode=inline',
    'live'
  ),
  req(
    'audio',
    'storage',
    'storage.presigned_url',
    'GET /storage/files/{id}/presigned-url',
    'Fallback stream when blob fetch fails; may fail CORS for waveform decode',
    'GET /storage/files/{id}/presigned-url',
    'workaround'
  ),
  req(
    'video',
    'storage',
    'storage.artifact_download',
    'GET /storage/artifacts/{id}/download?mode=inline',
    'Blob fallback for video player when presigned unavailable',
    'GET /storage/artifacts/{id}/download?mode=inline',
    'workaround'
  ),
  req(
    'video',
    'storage',
    'storage.presigned_url',
    'GET /storage/files/{id}/presigned-url',
    'Primary video stream (Range requests); presigned-first in video-watch-page',
    'GET /storage/files/{id}/presigned-url',
    'live'
  ),
  req(
    'audio',
    'storage',
    'storage.transcript',
    'GET /storage/files/{artifact_id}/transcript',
    'TranscriptPanel — gateway adapts storage segments (upstream: artifact_audio_segments)',
    'GET /storage/files/{artifact_id}/transcript',
    'live'
  ),
  req(
    'video',
    'storage',
    'storage.transcript',
    'GET /storage/files/{artifact_id}/transcript',
    'Video watch page transcript panel — gateway segment adapter',
    'GET /storage/files/{artifact_id}/transcript',
    'live'
  ),
  req(
    'video',
    'storage',
    'storage.chapters',
    'GET /storage/files/{artifact_id}/chapters',
    'VideoPlayer advanced mode — ChaptersPanel',
    'GET /storage/files/{artifact_id}/chapters',
    'live'
  ),
  req(
    'video',
    'storage',
    'storage.subtitles',
    'GET /storage/files/{artifact_id}/subtitles',
    'VideoPlayer CC + SubtitlesPanel',
    'GET /storage/files/{artifact_id}/subtitles',
    'live'
  ),
  req(
    'video',
    'storage',
    'storage.filmstrip',
    'GET /storage/files/{artifact_id}/filmstrip',
    'Advanced filmstrip timeline (sprite sheet)',
    'GET /storage/files/{artifact_id}/filmstrip',
    'live'
  ),
  req(
    'video',
    'storage',
    'storage.artifact_metadata',
    'GET /storage/artifacts/{artifact_id}',
    'duration/width/height for player header — see video-player-backend-handoff VP-BE-P0-3',
    'GET /storage/artifacts/{artifact_id}',
    'live'
  ),
  req(
    'audio',
    'storage',
    'storage.waveform_peaks',
    'GET /storage/files/{artifact_id}/waveform-peaks?bins=128',
    'Precomputed peaks — useWaveformPeaks hook (P2)',
    'GET /storage/files/{artifact_id}/waveform-peaks',
    'live'
  ),
  req(
    'audio',
    'any',
    'search.stt',
    'POST /search/stt',
    'Voice search — MediaRecorder → transcript query',
    'POST /search/stt',
    'live'
  ),
  req(
    'any',
    'any',
    'search.metrics',
    'GET /search/metrics',
    'Admin dashboard search activity widget',
    'GET /search/metrics',
    'live'
  ),
  req('file', 'files', 'plugin.smart_search', SMART_SEARCH, 'mode=file — non-media artifacts', SMART_SEARCH, 'live'),
  req(
    'image',
    'storage',
    'chat.upload',
    'POST /upload',
    'Visual query staging — wired (persists to DB; ephemeral DELETE on clear)',
    'POST /upload',
    'resolved'
  ),
  req(
    'image',
    'storage',
    'storage.artifact_delete',
    'POST /tools/plugin_file_manager_batch/execute',
    'Ephemeral visual query cleanup — primary path (delete action batch)',
    'POST /tools/plugin_file_manager_batch/execute',
    'live'
  ),
  req(
    'image',
    'storage',
    'storage.artifact_delete_legacy',
    'DELETE /storage/artifacts/{id}',
    'Deprecated direct delete — prefer file_manager batch',
    'DELETE /storage/artifacts/{id}',
    'optional'
  ),
  req(
    'image',
    'storage',
    'smart_search.exclude_query_artifact',
    SMART_SEARCH,
    'Query artifact excluded server-side from visual hits (B7)',
    SMART_SEARCH,
    'resolved'
  ),
  req(
    'any',
    'any',
    'smart_search.args.filters_sort_pagination',
    SMART_SEARCH,
    'args.filters, sort, pagination honored per lane (basic facets still client-side)',
    SMART_SEARCH,
    'resolved'
  ),
  req(
    'image',
    'storage',
    'storage.thumbnail',
    'GET /storage/files/{id}/thumbnail',
    'Image result grid thumbnails',
    'GET /storage/files/{id}/thumbnail',
    'live'
  ),
  req(
    'image',
    'storage',
    'plugin.file_manager.batch',
    'POST /tools/plugin_file_manager_batch/execute',
    'Ephemeral visual query cleanup (delete action) — same as storage.artifact_delete',
    'POST /tools/plugin_file_manager_batch/execute',
    'live'
  ),
  req(
    'image',
    'storage',
    'storage.upload_chunked',
    'POST /storage/upload/init',
    'Large visual query files (>10MB) — chunked upload then batch delete',
    'POST /storage/upload/init',
    'live'
  ),
  req(
    'any',
    'files',
    'storage.preview',
    'GET /storage/files/{id}/preview',
    'File hit preview modal (PDF page, text excerpt) via useFilePreview',
    'GET /storage/files/{id}/preview',
    'live'
  ),
  req(
    'any',
    'any',
    'search.gateway_query',
    'POST /search/query',
    'Future REST federated endpoint (gateway-query provider)',
    'POST /search/query',
    'live'
  ),
  req(
    'image',
    'storage',
    'storage.temp_upload',
    'POST /storage/temp-upload',
    'TTL upload without catalog entry',
    'POST /storage/temp-upload?purpose=visual_search&ttl=24h',
    'live'
  ),
];

export function requirementsForMode(mode: OneSearchMode): OneSearchDataSourceDescriptor[] {
  return ONE_SEARCH_API_REQUIREMENTS.filter((r) => r.mode === mode || r.mode === 'any');
}

export {
  BACKEND_CAPABILITY_GAPS,
  capabilityGapsForMode,
  type BackendCapabilityGap,
  type BackendGapPriority,
} from './backend-capability-gaps';
