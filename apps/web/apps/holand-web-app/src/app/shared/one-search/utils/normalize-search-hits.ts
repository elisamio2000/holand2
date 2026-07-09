// ============================================
// One Search — normalize/enrich hits after any provider
// ============================================

import { THUMBNAIL_PRESETS } from '@/config/file-upload.config';
import { routes } from '@/config/routes';
import { storageService } from '@/services/storage.service';
import type {
  OneSearchHit,
  OneSearchLaneId,
  OneSearchResponse,
} from '@/types/one-search.types';
import { supportsStorageThumbnailEndpoint } from '@/utils/storage-media-url';
import { dedupeHitsByArtifactId } from './media-hit-meta';

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
};

const AUDIO_EXT = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']);
const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', 'mkv']);

function fileExtension(title: string): string | undefined {
  const base = title.split(/[/\\]/).pop() ?? title;
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return undefined;
  return base.slice(dot + 1).toLowerCase();
}

function mediaTypeFromMime(mime: string): string | undefined {
  const m = mime.toLowerCase();
  if (m.startsWith('image/')) return 'image';
  if (m.startsWith('audio/')) return 'audio';
  if (m.startsWith('video/')) return 'video';
  if (m.startsWith('text/')) return 'text';
  return undefined;
}

/** Infer MIME from meta.mime → media_type → title extension. */
export function inferHitMime(hit: OneSearchHit): string {
  const meta = hit.meta ?? {};
  const explicit = String(meta.mime ?? '').trim();
  if (explicit) return explicit;

  const mediaType = String(meta.media_type ?? '').toLowerCase();
  if (mediaType === 'image') return 'image/jpeg';
  if (mediaType === 'audio') return 'audio/mpeg';
  if (mediaType === 'video') return 'video/mp4';

  const ext = fileExtension(hit.title);
  if (ext && EXT_MIME[ext]) return EXT_MIME[ext];

  return '';
}

export function inferHitMediaType(hit: OneSearchHit): string {
  const meta = hit.meta ?? {};
  const mediaType = String(meta.media_type ?? '').toLowerCase();
  if (mediaType && mediaType !== 'other' && mediaType !== 'document') return mediaType;

  const mime = inferHitMime(hit);
  if (mime) {
    const fromMime = mediaTypeFromMime(mime);
    if (fromMime) return fromMime;
  }

  const ext = fileExtension(hit.title);
  if (ext) {
    if (IMAGE_EXT.has(ext)) return 'image';
    if (AUDIO_EXT.has(ext)) return 'audio';
    if (VIDEO_EXT.has(ext)) return 'video';
  }

  return mediaType || 'other';
}

function partnerIdFromMeta(meta: Record<string, unknown>): string | undefined {
  for (const key of ['from', 'user_id', 'partner_id', 'partnerId']) {
    const raw = meta[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
    if (raw && typeof raw === 'object' && 'id' in (raw as object)) {
      const id = (raw as { id?: string }).id;
      if (typeof id === 'string' && id.trim()) return id.trim();
    }
  }
  return undefined;
}

/** Deep link to People chat with conversation partner. */
export function buildMessagesChatHref(
  meta: Record<string, unknown>,
  fallbackQuery?: string
): string {
  const partnerId = partnerIdFromMeta(meta);
  if (partnerId) return routes.messagesPeopleChat(partnerId);
  if (fallbackQuery?.trim()) {
    return `${routes.messages}?search=${encodeURIComponent(fallbackQuery.trim())}`;
  }
  return routes.messages;
}

/** File Explorer URL with optional search + artifact selection. */
export function buildFileExplorerArtifactHref(
  artifactId: string,
  query?: string
): string {
  const params = new URLSearchParams();
  if (query?.trim()) params.set('search', query.trim());
  params.set('artifact', artifactId);
  const qs = params.toString();
  return qs ? `${routes.fileExplorer}?${qs}` : routes.fileExplorer;
}

function enrichArtifactHit(hit: OneSearchHit, query: string): OneSearchHit {
  const meta = { ...(hit.meta ?? {}) };
  const artifactId =
    typeof meta.artifact_id === 'string' && meta.artifact_id.length > 0
      ? meta.artifact_id
      : undefined;

  if (!artifactId) return hit;

  const mime = inferHitMime({ ...hit, meta: { ...meta, mime: meta.mime ?? inferHitMime(hit) } });
  const mediaType = inferHitMediaType({ ...hit, meta: { ...meta, mime } });
  meta.mime = mime || meta.mime;
  meta.media_type = mediaType;

  if (!meta.url) {
    meta.url = storageService.getDownloadUrl(artifactId, 'inline');
  }

  if (
    !meta.thumb_url &&
    supportsStorageThumbnailEndpoint(mime, mediaType)
  ) {
    const preset = THUMBNAIL_PRESETS.fileExplorerGrid;
    meta.thumb_url = storageService.getThumbnailUrl(
      artifactId,
      preset.width,
      preset.height,
      'webp',
      preset.quality,
      mime,
      mediaType
    );
  }

  return {
    ...hit,
    href: buildFileExplorerArtifactHref(artifactId, query),
    meta,
  };
}

function laneFromMeta(meta: Record<string, unknown>, fallback: OneSearchLaneId): OneSearchLaneId {
  const lane = meta.lane;
  if (
    lane === 'chat' ||
    lane === 'cases' ||
    lane === 'files' ||
    lane === 'storage' ||
    lane === 'users' ||
    lane === 'graph'
  ) {
    return lane;
  }
  return fallback;
}

/** Normalize a single hit (href, mime, artifact URLs). */
export function normalizeSearchHit(
  hit: OneSearchHit,
  query: string,
  laneHint?: OneSearchLaneId
): OneSearchHit {
  const meta = { ...(hit.meta ?? {}) };
  const lane = laneFromMeta(meta, laneHint ?? 'files');
  const mime = inferHitMime({ ...hit, meta });
  const mediaType = inferHitMediaType({ ...hit, meta: { ...meta, mime } });

  meta.mime = mime || meta.mime;
  meta.media_type = mediaType;

  if (lane === 'chat') {
    return {
      ...hit,
      meta,
      href: buildMessagesChatHref(meta, query),
    };
  }

  if (lane === 'files' || lane === 'storage') {
    return enrichArtifactHit({ ...hit, meta }, query);
  }

  return { ...hit, meta };
}

/** Apply normalization to all lane hits (post-provider). */
export function normalizeSearchResponse(
  response: OneSearchResponse,
  query: string
): OneSearchResponse {
  return {
    ...response,
    lanes: response.lanes.map((laneRow) => ({
      ...laneRow,
      hits: dedupeHitsByArtifactId(
        laneRow.hits.map((hit) => normalizeSearchHit(hit, query, laneRow.lane))
      ),
    })),
  };
}
