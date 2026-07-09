// ============================================
// Per-surface endpoint bullets for SearchSurfaceEndpointGuide
// ============================================

import type { OneSearchMode } from '@/types/one-search.types';

export type SurfaceEndpointStatus =
  | 'live'
  | 'resolved'
  | 'workaround'
  | 'binding'
  | 'missing'
  | 'optional';

export interface SurfaceEndpointBullet {
  endpoint: string;
  status: SurfaceEndpointStatus;
  /** i18n key under searchHub.surfaceGuide.bullets */
  noteKey: string;
}

export const SURFACE_ENDPOINT_GUIDE: Record<OneSearchMode, SurfaceEndpointBullet[]> = {
  all: [
    { endpoint: 'POST /tools/plugin_smart_search/execute', status: 'live', noteKey: 'smartSearchAll' },
    { endpoint: 'POST /upload + query_image', status: 'resolved', noteKey: 'visualUpload' },
    { endpoint: 'DELETE /storage/artifacts/{id}', status: 'resolved', noteKey: 'ephemeralCleanup' },
    { endpoint: 'exclude query_image from hits (server)', status: 'resolved', noteKey: 'excludeQueryArtifact' },
    { endpoint: 'args.filters + args.sort + pagination', status: 'resolved', noteKey: 'serverFacets' },
    { endpoint: 'args.user_id → cases/users RBAC', status: 'resolved', noteKey: 'userIdForwarding' },
    { endpoint: 'data.metadata.query_image echo', status: 'resolved', noteKey: 'queryImageEcho' },
    { endpoint: 'plugin_smart_search_text (semantic)', status: 'binding', noteKey: 'semanticText' },
    { endpoint: 'plugin_smart_search_image_by_example', status: 'binding', noteKey: 'visualBinding' },
    { endpoint: 'POST /search/query', status: 'missing', noteKey: 'restFederated' },
    { endpoint: 'args.session_id', status: 'missing', noteKey: 'sessionContext' },
    { endpoint: 'response.suggestions.relatedSearches', status: 'missing', noteKey: 'relatedSearches' },
    { endpoint: 'GET /search/metrics', status: 'missing', noteKey: 'searchMetrics' },
  ],
  text: [
    { endpoint: 'POST /tools/plugin_smart_search/execute (mode=text)', status: 'live', noteKey: 'smartSearchText' },
    { endpoint: 'Transcript hits in files lane', status: 'resolved', noteKey: 'textModeTranscripts' },
    { endpoint: 'plugin_smart_search_text binding', status: 'binding', noteKey: 'semanticText' },
  ],
  image: [
    { endpoint: 'POST /upload', status: 'resolved', noteKey: 'visualUpload' },
    { endpoint: 'DELETE /storage/artifacts/{id}', status: 'resolved', noteKey: 'ephemeralCleanup' },
    { endpoint: 'POST /tools/plugin_smart_search/execute', status: 'live', noteKey: 'smartSearchImage' },
    { endpoint: 'data.metadata.query_image echo', status: 'resolved', noteKey: 'queryImageEcho' },
    { endpoint: 'exclude query_image from hits (server)', status: 'resolved', noteKey: 'excludeQueryArtifact' },
    { endpoint: 'plugin_smart_search_image_by_example', status: 'binding', noteKey: 'visualBinding' },
    { endpoint: 'plugin_smart_search_image_clip (SigLIP)', status: 'binding', noteKey: 'clipBinding' },
    { endpoint: 'GET /storage/files/{id}/thumbnail', status: 'live', noteKey: 'thumbnails' },
    { endpoint: 'POST /storage/temp-upload', status: 'missing', noteKey: 'tempUpload' },
  ],
  video: [
    { endpoint: 'POST /tools/plugin_smart_search/execute (mode=video)', status: 'live', noteKey: 'smartSearchVideo' },
    { endpoint: 'GET /storage/files/{id}/presigned-url', status: 'live', noteKey: 'mediaStream' },
    {
      endpoint: 'GET /storage/artifacts/{id}/download?mode=inline',
      status: 'workaround',
      noteKey: 'videoPlaybackBlobFallback',
    },
    { endpoint: 'args.sort/filters/pagination → smart_search', status: 'resolved', noteKey: 'mediaServerRefetch' },
    { endpoint: 'Transcript text index (text_search binding)', status: 'binding', noteKey: 'transcriptIndex' },
    { endpoint: 'GET /storage/files/{id}/transcript', status: 'missing', noteKey: 'transcriptGet' },
    { endpoint: 'hit.meta.duration + transcript_match', status: 'missing', noteKey: 'audioHitMetadata' },
  ],
  audio: [
    { endpoint: 'POST /tools/plugin_smart_search/execute (mode=audio)', status: 'live', noteKey: 'smartSearchAudio' },
    {
      endpoint: 'GET /storage/artifacts/{id}/download?mode=inline',
      status: 'live',
      noteKey: 'audioPlaybackJwt',
    },
    {
      endpoint: 'GET /storage/files/{id}/presigned-url',
      status: 'workaround',
      noteKey: 'audioPresignedFallback',
    },
    { endpoint: 'args.sort/filters/pagination → smart_search', status: 'resolved', noteKey: 'mediaServerRefetch' },
    { endpoint: 'Transcript text index (text_search binding)', status: 'binding', noteKey: 'transcriptIndex' },
    { endpoint: 'GET /storage/files/{id}/transcript', status: 'missing', noteKey: 'transcriptGet' },
    { endpoint: 'hit.meta.duration + transcript_match', status: 'missing', noteKey: 'audioHitMetadata' },
    { endpoint: 'POST /search/stt (voice query)', status: 'missing', noteKey: 'voiceStt' },
    { endpoint: 'GET /storage/files/{id}/waveform-peaks', status: 'missing', noteKey: 'waveformPeaks' },
  ],
  file: [
    { endpoint: 'POST /tools/plugin_smart_search/execute (mode=file)', status: 'live', noteKey: 'smartSearchFile' },
    { endpoint: 'POST /tools/plugin_file_manager_list/execute', status: 'optional', noteKey: 'fileManagerSupplement' },
    { endpoint: 'args.filters + sort + pagination', status: 'resolved', noteKey: 'serverFacets' },
    { endpoint: 'plugin_smart_search_text (semantic rank)', status: 'binding', noteKey: 'semanticText' },
  ],
};

export const ENDPOINT_GUIDE_DOC_PATH =
  'docs/backend-integration/03-frontend-pages/one-search-endpoint-guide.md';
