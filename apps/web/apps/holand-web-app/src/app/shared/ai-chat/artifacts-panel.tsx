// ============================================
// ArtifactsPanel — Session file artifacts display
// Shows uploaded files/artifacts for the current session
// ============================================

'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiTrash,
  PiX,
  PiWarningCircle,
  PiDownloadSimpleBold,
  PiClock,
  PiFolder,
  PiEye,
  PiImageBold,
} from 'react-icons/pi';
import { useAtom } from 'jotai';
import cn from '@core/utils/class-names';
import FileTypeIcon from '@/components/file-type-icon';
import {
  MpsUltraCompactAudio,
  MpsUltraCompactVideo,
} from '@/components/media-playback';
import FileIcon from '@core/components/icons/file-solid';
import { Loader } from 'rizzui';
import toast from 'react-hot-toast';
import { chatService } from '@/services/chat.service';
import { formatFileSize, THUMBNAIL_PRESETS } from '@/config/file-upload.config';
import { isImageMimeType } from '@/utils/file-icons';
import { artifactPreviewCacheAtom } from '@/hooks/use-chat';
import AuthenticatedImage from './authenticated-image';
// WHY: Import from global file-preview module — works from any section of the app, not just chat
import { useFilePreview } from '@/app/shared/file-preview';
import type { StorageArtifact } from '@/types/chat.types';

/** `overlay` = fixed slide-over (mobile). `inline` = docked in AiChat right rail (desktop). */
export type ArtifactsPanelLayout = 'overlay' | 'inline';

interface ArtifactsPanelProps {
  /** Whether the panel is visible */
  isOpen: boolean;
  /** Close the panel */
  onClose: () => void;
  /** Currently active session ID */
  activeSessionId?: string | null;
  /** Presentation: slide-over vs docked column */
  layout?: ArtifactsPanelLayout;
}

/**
 * ArtifactsPanel — Displays uploaded files/artifacts for the current chat session.
 *
 * Features:
 * - View all artifacts uploaded in the active session
 * - File type icons based on media_type/mime_type
 * - File size display (human-readable)
 * - Delete artifact with confirmation
 * - Empty state when no artifacts exist
 *
 * Connects to Storage Service endpoints (via Gateway):
 * - GET /storage/artifacts?session_id=xxx — list session artifacts
 * - DELETE /storage/artifacts/{id} — delete artifact
 *
 * @requires chatService — for API calls
 *
 * @example
 * ```tsx
 * <ArtifactsPanel
 *   isOpen={isArtifactsPanelOpen}
 *   onClose={() => setIsArtifactsPanelOpen(false)}
 *   activeSessionId={activeSessionId}
 * />
 * ```
 */

/**
 * Format a date string into a short human-readable form.
 */
function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('fa-IR', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function ArtifactsPanel({
  isOpen,
  onClose,
  activeSessionId,
  layout = 'overlay',
}: ArtifactsPanelProps) {
  const { t } = useTranslation();
  const [artifacts, setArtifacts] = useState<StorageArtifact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // Global file preview hook — works from any page (not chat-specific)
  const { openFilePreview } = useFilePreview();

  // Local blob URL cache from recent uploads (populated by useChat on upload)
  const [previewCache] = useAtom(artifactPreviewCacheAtom);

  /**
   * Fetch artifacts for the active session.
   */
  const fetchArtifacts = useCallback(async () => {
    if (!activeSessionId) {
      setArtifacts([]);
      return;
    }

    console.info('[ArtifactsPanel] Fetching artifacts:', { activeSessionId });
    setIsLoading(true);
    setError(null);

    try {
      const data = await chatService.getSessionArtifacts(activeSessionId);
      setArtifacts(data);
      console.info('[ArtifactsPanel] Artifacts loaded:', { count: data.length });
    } catch (err: unknown) {
      console.error('[ArtifactsPanel] Failed to fetch artifacts:', err);
      setError(t('artifactsPanel.errorLoad'));
    } finally {
      setIsLoading(false);
    }
  }, [activeSessionId, t]);

  // Fetch on open or session change
  useEffect(() => {
    if (isOpen && activeSessionId) {
      fetchArtifacts();
    }
  }, [isOpen, activeSessionId, fetchArtifacts]);

  /**
   * Delete an artifact with confirmation.
   */
  const handleDelete = useCallback(
    async (artifact: StorageArtifact) => {
      const filename = artifact.original_filename || artifact.id;
      if (!confirm(t('artifactsPanel.deleteConfirm', { filename }))) return;

      console.info('[ArtifactsPanel] Deleting artifact:', { id: artifact.id, filename });
      setDeletingId(artifact.id);

      try {
        await chatService.deleteArtifact(artifact.id);
        setArtifacts((prev) => prev.filter((a) => a.id !== artifact.id));
        toast.success(t('artifactsPanel.deleted', { filename }));
        console.info('[ArtifactsPanel] Artifact deleted:', { id: artifact.id });
      } catch (err: unknown) {
        console.error('[ArtifactsPanel] Delete failed:', { id: artifact.id, err });
        toast.error(t('artifactsPanel.errorDelete'));
      } finally {
        setDeletingId(null);
      }
    },
    [t]
  );

  /**
   * Open file preview in the global modal via useFilePreview hook.
   * The hook handles category detection, modal sizing, and rendering.
   *
   * WHY: Always use artifact.id for the download URL — storage_path is a raw
   * filesystem path (e.g. "users/xxx/files/doc.pdf") and is NOT a valid HTTP
   * route on the API Gateway. The correct endpoint is:
   * GET /storage/artifacts/{id}/download (proxied via Gateway as /storage/artifacts/{id}/download)
   */
  const handlePreview = useCallback((artifact: StorageArtifact) => {
    const localUrl = previewCache[artifact.id];
    // Always use artifact ID — ensures correct Gateway endpoint resolution
    const backendUrl = chatService.getArtifactUrl(artifact.id);
    const mimeType = artifact.mime_type ?? artifact.media_type;
    const fileName = artifact.original_filename || 'file';

    console.info('[ArtifactsPanel] Opening file preview:', {
      id: artifact.id,
      name: fileName,
      mimeType,
      hasLocalUrl: !!localUrl,
    });

    // Use global hook — handles modal size + rendering automatically
    openFilePreview({
      src: backendUrl,
      name: fileName,
      mimeType: mimeType || null,
      fileSize: artifact.file_size_bytes,
      localPreviewUrl: localUrl,
      artifactId: artifact.id,
    });
  }, [previewCache, openFilePreview]);

  /**
   * Download a file from storage.
   * Prefers local blob URL from cache, falls back to fetching via backend URL.
   */
  const handleDownload = useCallback(async (artifact: StorageArtifact) => {
    const filename = artifact.original_filename || 'download';
    console.info('[ArtifactsPanel] Downloading:', { id: artifact.id, filename });
    setDownloadingId(artifact.id);

    try {
      // Check for local blob URL first (works without backend file-serving endpoint)
      const localUrl = previewCache[artifact.id];
      if (localUrl) {
        const a = document.createElement('a');
        a.href = localUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success(t('artifactsPanel.downloaded', { filename }));
        console.info('[ArtifactsPanel] Downloaded from local cache:', { filename });
        return;
      }

      // ⚠️ Use artifact.id — storage_path is a minio:// URI after v0.15.0 backend migration
      // and cannot be used as an HTTP endpoint. ID-based download endpoint is stable.
      const url = chatService.getArtifactUrl(artifact.id);
      await chatService.downloadFile(url, filename);
      toast.success(t('artifactsPanel.downloaded', { filename }));
    } catch (err: unknown) {
      console.error('[ArtifactsPanel] Download failed:', { id: artifact.id, err });
      toast.error(t('artifactsPanel.errorDownloadBackend'));
    } finally {
      setDownloadingId(null);
    }
  }, [previewCache, t]);

  // Don't render when closed
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        'relative z-[999] flex min-h-0 flex-col overflow-hidden bg-gray-0 dark:bg-gray-50',
        layout === 'overlay' &&
          'fixed end-0 bottom-0 top-[70px] w-80 flex-col border-s border-muted shadow-xl lg:top-[72px]',
        layout === 'inline' && 'h-full w-full'
      )}
      role="complementary"
      aria-label={t('artifactsPanel.ariaLabel')}
    >
      {/* Header — overlay only; docked rail uses AiChat tab row as chrome (matches ChatSidebar pattern). */}
      {layout === 'overlay' && (
        <div className="flex flex-shrink-0 items-center justify-between border-b border-muted px-4 py-3">
          <div className="flex items-center gap-2">
            <PiFolder className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-700">
              {t('artifactsPanel.title')}
            </span>
            {artifacts.length > 0 && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 dark:bg-gray-200/30">
                {artifacts.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-200/20"
            aria-label={t('artifactsPanel.close')}
          >
            <PiX className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="custom-scrollbar scrollbar-no-auto-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader size="lg" />
            <span className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              {t('artifactsPanel.loading')}
            </span>
          </div>
        )}

        {/* Error state */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PiWarningCircle className="mb-2 h-8 w-8 text-red-400" />
            <p className="text-sm text-red-500">{error}</p>
            <button
              onClick={fetchArtifacts}
              className="mt-3 text-xs text-primary hover:underline"
            >
              {t('artifactsPanel.tryAgain')}
            </button>
          </div>
        )}

        {/* No active session */}
        {!isLoading && !error && !activeSessionId && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <PiFolder className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-500" />
            <p className="text-sm text-gray-500">
              {t('artifactsPanel.emptySelectSession')}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && activeSessionId && artifacts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileIcon className="mb-2 h-8 w-8" />
            <p className="text-sm text-gray-500">
              {t('artifactsPanel.emptyNone')}
            </p>
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
              {t('artifactsPanel.emptyHint')}
            </p>
          </div>
        )}

        {/* Artifacts list */}
        {!isLoading && artifacts.length > 0 && (
          <div className="space-y-2">
            {artifacts.map((artifact) => {
              const isImage = isImageMimeType(artifact.mime_type) || artifact.media_type?.toLowerCase() === 'image';
              const isVideo = artifact.mime_type?.toLowerCase().startsWith('video/') || artifact.media_type?.toLowerCase() === 'video';
              const isAudio = artifact.mime_type?.toLowerCase().startsWith('audio/') || artifact.media_type?.toLowerCase() === 'audio';
              // ⚠️ v0.15.0: storage_path is now a minio:// URI — not a valid HTTP route.
              // Use artifact.id to gate preview/download buttons instead.
              const hasPath = !!artifact.id;
              const isDeleting = deletingId === artifact.id;
              const isDownloading = downloadingId === artifact.id;

              if (isVideo && hasPath) {
                const backendUrl = chatService.getArtifactUrl(artifact.id);
                const localUrl = previewCache[artifact.id];
                const videoThumb = chatService.getArtifactThumbnailUrl(
                  artifact.id,
                  THUMBNAIL_PRESETS.panelIcon.width,
                  THUMBNAIL_PRESETS.panelIcon.height,
                  'webp',
                  THUMBNAIL_PRESETS.panelIcon.quality,
                  artifact.mime_type ?? undefined
                );

                return (
                  <div
                    key={artifact.id}
                    className={cn(
                      'group flex items-start gap-2 rounded-lg border border-muted p-2 transition-colors',
                      'hover:border-primary/20 hover:bg-gray-50/50 dark:hover:bg-gray-100/30',
                      (isDeleting || isDownloading) && 'opacity-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <MpsUltraCompactVideo
                        src={backendUrl}
                        localPreviewUrl={localUrl}
                        title={artifact.original_filename || t('artifactsPanel.unnamed')}
                        mimeType={artifact.mime_type ?? undefined}
                        fileSize={artifact.file_size_bytes ?? undefined}
                        artifactId={artifact.id}
                        poster={localUrl ? undefined : (videoThumb ?? undefined)}
                        rowId={artifact.id}
                        onDownload={() => void handleDownload(artifact)}
                      />
                      {artifact.created_at && (
                        <p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-gray-400 dark:text-gray-500">
                          <PiClock className="h-3 w-3" />
                          {formatDate(artifact.created_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Tooltip content={t('artifactsPanel.deleteTooltip')} placement="left">
                        <button
                          onClick={() => handleDelete(artifact)}
                          disabled={isDeleting}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                          aria-label={t('artifactsPanel.deleteAria', {
                            filename: artifact.original_filename || t('artifactsPanel.fileSingular'),
                          })}
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              }

              if (isAudio && hasPath) {
                const backendUrl = chatService.getArtifactUrl(artifact.id);
                const localUrl = previewCache[artifact.id];

                return (
                  <div
                    key={artifact.id}
                    className={cn(
                      'group flex items-start gap-2 rounded-lg border border-muted p-2 transition-colors',
                      'hover:border-primary/20 hover:bg-gray-50/50 dark:hover:bg-gray-100/30',
                      (isDeleting || isDownloading) && 'opacity-50'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <MpsUltraCompactAudio
                        src={backendUrl}
                        localPreviewUrl={localUrl}
                        title={artifact.original_filename || t('artifactsPanel.unnamed')}
                        mimeType={artifact.mime_type ?? undefined}
                        fileSize={artifact.file_size_bytes ?? undefined}
                        artifactId={artifact.id}
                        rowId={artifact.id}
                        onDownload={() => void handleDownload(artifact)}
                      />
                      {artifact.created_at && (
                        <p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-gray-400 dark:text-gray-500">
                          <PiClock className="h-3 w-3" />
                          {formatDate(artifact.created_at)}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <Tooltip content={t('artifactsPanel.deleteTooltip')} placement="left">
                        <button
                          onClick={() => handleDelete(artifact)}
                          disabled={isDeleting}
                          className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                          aria-label={t('artifactsPanel.deleteAria', {
                            filename: artifact.original_filename || t('artifactsPanel.fileSingular'),
                          })}
                        >
                          <PiTrash className="h-4 w-4" />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={artifact.id}
                  className={cn(
                    'group flex items-start gap-3 rounded-lg border border-muted p-3 transition-colors',
                    'hover:border-primary/20 hover:bg-gray-50/50 dark:hover:bg-gray-100/30',
                    (isDeleting || isDownloading) && 'opacity-50'
                  )}
                >
                  {/* Thumbnail — context-aware based on file type */}
                  <div className="mt-0.5 flex-shrink-0">
                    {isImage ? (
                      (() => {
                        const localUrl = previewCache[artifact.id];
                        // ⚠️ ALWAYS use artifact.id — storage_path is a minio:// URI after v0.15.0
                        // backend migration and is not a valid HTTP endpoint.
                        const backendUrl = chatService.getArtifactUrl(artifact.id);
                        // Thumbnail endpoint uses artifact ID directly — stable, efficient, works with MinIO
                        // Pass mime_type so SVGs skip thumbnail (backend can't rasterize vectors)
                        const thumbnailUrl = chatService.getArtifactThumbnailUrl(artifact.id, THUMBNAIL_PRESETS.panelIcon.width, THUMBNAIL_PRESETS.panelIcon.height, 'webp', THUMBNAIL_PRESETS.panelIcon.quality, artifact.mime_type);
                        return (localUrl || backendUrl) ? (
                          <div
                            className="h-10 w-10 cursor-pointer overflow-hidden rounded border border-muted"
                            onClick={() => handlePreview(artifact)}
                          >
                            <AuthenticatedImage
                              src={backendUrl ?? ''}
                              localPreviewUrl={localUrl}
                              thumbnailSrc={localUrl ? undefined : (thumbnailUrl ?? undefined)}
                              alt={artifact.original_filename || 'image'}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded border border-muted bg-gray-100 dark:bg-gray-200/30">
                            <PiImageBold className="h-5 w-5 text-gray-400" />
                          </div>
                        );
                      })()
                    ) : isVideo ? (
                      <div className="flex h-10 w-10 items-center justify-center rounded border border-muted bg-gray-100 dark:bg-gray-200/30">
                        <PiEye className="h-5 w-5 text-gray-400" />
                      </div>
                    ) : (
                      <div className="relative mt-0.5 shrink-0">
                        <FileTypeIcon
                          mimeType={artifact.mime_type ?? artifact.media_type}
                          filename={artifact.original_filename}
                          size="md"
                          onClick={() => handlePreview(artifact)}
                        />
                      </div>
                    )}
                  </div>

                  {/* File info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-700 dark:text-gray-300">
                      {artifact.original_filename || t('artifactsPanel.unnamed')}
                    </p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                      <span>{formatFileSize(artifact.file_size_bytes)}</span>
                      {artifact.media_type && (
                        <span className="capitalize">{artifact.media_type}</span>
                      )}
                      {artifact.created_at && (
                        <span className="flex items-center gap-1">
                          <PiClock className="h-3 w-3" />
                          {formatDate(artifact.created_at)}
                        </span>
                      )}
                    </div>

                    {/* Action buttons — always visible */}
                    {hasPath && (
                      <div className="mt-1.5 flex items-center gap-3 text-xs">
                        <button
                          onClick={() => handlePreview(artifact)}
                          className="flex items-center gap-1 text-gray-500 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                        >
                          <PiEye className="h-3.5 w-3.5" />
                          <span>{t('artifactsPanel.preview')}</span>
                        </button>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <button
                          onClick={() => handleDownload(artifact)}
                          disabled={isDownloading}
                          className="flex items-center gap-1 text-gray-500 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-primary"
                        >
                          <PiDownloadSimpleBold className="h-3.5 w-3.5" />
                          <span>{isDownloading ? t('artifactsPanel.downloading') : t('artifactsPanel.download')}</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Delete — visible on hover */}
                  <div className="flex flex-shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Tooltip content={t('artifactsPanel.deleteTooltip')} placement="left">
                      <button
                        onClick={() => handleDelete(artifact)}
                        disabled={isDeleting}
                        className="rounded p-1 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/20"
                        aria-label={t('artifactsPanel.deleteAria', { filename: artifact.original_filename || t('artifactsPanel.fileSingular') })}
                      >
                        <PiTrash className="h-4 w-4" />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer — total size summary */}
      {artifacts.length > 0 && (
        <div className="flex-shrink-0 border-t border-muted px-4 py-2">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            {artifacts.length} {artifacts.length !== 1 ? t('artifactsPanel.filePlural') : t('artifactsPanel.fileSingular')} —{' '}
            {formatFileSize(
              artifacts.reduce((sum, a) => sum + (a.file_size_bytes ?? 0), 0)
            )}{' '}
            {t('artifactsPanel.totalSuffix')}
          </p>
        </div>
      )}

    </div>
  );
}
