// ============================================
// Storage media URL helpers — gateway thumbnail/preview rules
// @see documents/file_manager_frontend_guide.md §6
// OpenAPI: GET /storage/files/{id}/thumbnail (image only)
//          GET /storage/files/{id}/preview (PDF page, etc.)
// ============================================

/** Classified outcome of an authenticated storage blob fetch. */
export type StorageFetchFailureKind =
  | 'not_available'
  | 'server_error'
  | 'client_error'
  | 'rate_limited'
  | 'unauthorized'
  | 'network';

/** True when artifact is an image (mime and/or backend media_type). */
export function isImageArtifact(
  mimeType?: string | null,
  mediaType?: string | null
): boolean {
  if (mediaType === 'image') return true;
  if (!mimeType) return false;
  if (mimeType.includes('svg')) return false;
  return mimeType.startsWith('image/');
}

export function supportsStorageThumbnailEndpoint(
  mimeType?: string | null,
  mediaType?: string | null
): boolean {
  return isImageArtifact(mimeType, mediaType);
}

export function supportsStoragePreviewEndpoint(
  mimeType?: string | null,
  mediaType?: string | null
): boolean {
  if (mimeType === 'application/pdf') return true;
  if (mediaType === 'text') return true;
  return false;
}

/** Whether grid/list should attempt an inline visual preview. */
export function supportsArtifactVisualPreview(
  mimeType?: string | null,
  mediaType?: string | null
): boolean {
  return (
    supportsStorageThumbnailEndpoint(mimeType, mediaType) ||
    supportsStoragePreviewEndpoint(mimeType, mediaType)
  );
}

/** Thumbnail/preview URLs should go through the paced request queue. */
export function isStoragePreviewFetchUrl(url: string): boolean {
  return (
    url.includes('/storage/files/') &&
    (url.includes('/thumbnail') || url.includes('/preview'))
  );
}

export function classifyStorageHttpStatus(status: number): StorageFetchFailureKind {
  if (status === 404) return 'not_available';
  if (status === 401 || status === 403) return 'unauthorized';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server_error';
  return 'client_error';
}

/** Human-readable label for logs and optional UI tooltips (English; i18n at call site if needed). */
export function storageFetchFailureMessage(
  kind: StorageFetchFailureKind,
  status?: number
): string {
  switch (kind) {
    case 'not_available':
      return status
        ? `Preview not available (${status}). Showing file type icon.`
        : 'Preview not available. Showing file type icon.';
    case 'server_error':
      return status
        ? `Storage preview failed on server (${status}). Try again later or report to ops.`
        : 'Storage preview failed on server. Try again later.';
    case 'rate_limited':
      return 'Too many preview requests. Wait a moment and refresh.';
    case 'unauthorized':
      return 'Session expired or access denied. Sign in again.';
    case 'client_error':
      return status
        ? `Preview request rejected (${status}).`
        : 'Preview request rejected.';
    case 'network':
      return 'Network error while loading preview.';
    default:
      return 'Preview unavailable.';
  }
}

export function shouldWarnStorageFetchFailure(kind: StorageFetchFailureKind): boolean {
  return kind === 'server_error' || kind === 'rate_limited' || kind === 'unauthorized';
}

export function isStorageDebugEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    localStorage.getItem('DEBUG_STORAGE') === 'true' ||
    localStorage.getItem('DEBUG_CHAT') === 'true'
  );
}

const loggedFailureKeys = new Set<string>();

/**
 * Log storage preview failures with correct severity.
 * 404 (no thumbnail yet) → debug only; 5xx → warn once per URL per session.
 */
export function logStorageFetchFailure(
  scope: string,
  url: string,
  kind: StorageFetchFailureKind,
  status?: number
): void {
  const key = `${kind}:${status ?? 0}:${url}`;
  if (loggedFailureKeys.has(key)) return;
  loggedFailureKeys.add(key);

  const payload = {
    scope,
    url,
    status,
    kind,
    message: storageFetchFailureMessage(kind, status),
  };

  if (isStorageDebugEnabled()) {
    console.debug(`[${scope}] Storage fetch`, payload);
    return;
  }

  if (kind === 'not_available') return;

  if (shouldWarnStorageFetchFailure(kind)) {
    console.warn(`[${scope}] ${payload.message}`, payload);
  } else {
    console.debug(`[${scope}] ${payload.message}`, payload);
  }
}
