// ============================================
// One Search — build plugin_smart_search execute args
// ============================================

import type {
  OneSearchQueryImage,
  OneSearchRequest,
} from '@/types/one-search.types';
import { ONE_SEARCH_DEFAULT_LIMIT } from '../config/search-config';

export function mapQueryImageToApi(
  queryImage: OneSearchQueryImage
): Record<string, unknown> {
  const out: Record<string, unknown> = { artifact_id: queryImage.artifact_id };
  if (queryImage.path) out.path = queryImage.path;
  if (queryImage.crop) out.crop = queryImage.crop;
  return out;
}

/** Build gateway `args` for plugin_smart_search. Returns null when neither text nor image is set. */
export function buildSmartSearchArgs(
  request: OneSearchRequest
): Record<string, unknown> | null {
  const query = request.query.trim();
  const hasText = query.length > 0;
  const hasImage = Boolean(request.queryImage?.artifact_id);
  if (!hasText && !hasImage) return null;

  const mode = request.mode ?? 'all';
  const limit = request.pagination?.limit ?? ONE_SEARCH_DEFAULT_LIMIT;

  const args: Record<string, unknown> = {
    mode,
    top_k: limit,
  };

  if (hasText) args.query = query;
  if (request.scoreThreshold != null) args.score_threshold = request.scoreThreshold;
  if (request.sort) args.sort = request.sort;
  if (request.filters) {
    const f = request.filters;
    const filters: Record<string, unknown> = {};
    if (f.lanes?.length) filters.lanes = f.lanes;
    if (f.dateFrom) filters.date_from = f.dateFrom;
    if (f.dateTo) filters.date_to = f.dateTo;
    if (f.fileTypes?.length) filters.file_types = f.fileTypes;
    if (f.languages?.length) filters.languages = f.languages;
    if (Object.keys(filters).length > 0) args.filters = filters;
  }
  if (request.mediaFilters) {
    const m = request.mediaFilters;
    const media: Record<string, unknown> = {};
    if (m.mimeTypes?.length) media.mime_types = m.mimeTypes;
    if (m.durationMinSec != null) media.duration_min_sec = m.durationMinSec;
    if (m.durationMaxSec != null) media.duration_max_sec = m.durationMaxSec;
    if (m.hasTranscript) media.has_transcript = true;
    if (m.matchKinds?.length) media.match_kinds = m.matchKinds;
    if (m.uploadedBy) media.uploaded_by = m.uploadedBy;
    if (m.dateRange) media.date_range = m.dateRange;
    if (m.minSizeBytes != null) media.min_size_bytes = m.minSizeBytes;
    if (m.maxSizeBytes != null) media.max_size_bytes = m.maxSizeBytes;
    if (Object.keys(media).length > 0) {
      args.filters = { ...(args.filters as Record<string, unknown> | undefined), ...media };
    }
  }
  if (request.pagination) {
    args.pagination = {
      offset: request.pagination.offset ?? 0,
      limit: request.pagination.limit ?? limit,
    };
  }
  if (hasImage && request.queryImage) {
    args.query_image = mapQueryImageToApi(request.queryImage);
  }
  if (request.userId?.trim()) {
    args.user_id = request.userId.trim();
  }

  return args;
}
