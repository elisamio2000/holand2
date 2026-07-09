// ============================================
// useFilePreview — Global hook for opening file preview modals
// Works from any page or section, not just the chat.
// Abstracts the modal size calculation and openModal() call.
// ============================================

'use client';

import { useCallback } from 'react';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { getFileCategory } from '@/utils/mime-utils';
import { debugLog } from '@/utils/debug-logger';

import { extractArtifactIdFromGatewaySrc } from '@/utils/gateway-media-url';

/** Extract storage artifact UUID from gateway download URLs. */
function extractArtifactIdFromSrc(src?: string): string | undefined {
  return extractArtifactIdFromGatewaySrc(src);
}

/** Size map: match category to modal width */
const MODAL_SIZE_MAP: Record<string, string> = {
  image: '1200px',
  video: '1000px',
  audio: '500px',
  pdf: '900px',
  document: '800px',
  text: '800px',
  unknown: '500px',
};

interface OpenFilePreviewParams {
  /** Backend URL OR blob URL for the file */
  src: string;
  /** Display filename */
  name?: string;
  /** MIME type — used to determine viewer and modal size */
  mimeType?: string | null;
  /** File size in bytes for display */
  fileSize?: number | null;
  /** Pre-loaded local blob URL (e.g. from recent upload cache) — skips re-fetch */
  localPreviewUrl?: string;
  /** Storage artifact ID — enables presigned streaming for video/audio */
  artifactId?: string;
  /** Initial playback position when opening modal (e.g. transcript match seek) */
  initialCurrentTime?: number;
  /** Whether to auto-resume playback in modal */
  initialIsPlaying?: boolean;
  /** Optional media metadata (chapters, subtitles, dimensions) */
  meta?: Record<string, unknown>;
  /** Live sync while modal is open (inline PiP mirror on watch page / explorer) */
  onLivePlaybackSync?: (currentTime: number, isPlaying: boolean, modeFlag?: boolean) => void;
  /** Reverse sync when modal closes */
  onPlaybackSync?: (currentTime: number, isPlaying: boolean, modeFlag?: boolean) => void;
  /** Media Playback Session — shared element when expanding from an inline player */
  mediaSessionId?: string;
  /** Waveform toggle state when expanding audio from inline */
  initialShowWaveform?: boolean;
}

/**
 * useFilePreview — Global hook for opening authenticated file preview modals.
 *
 * Can be used from ANY page or component — chat, cases, storage, admin, etc.
 * Internally uses the global GlobalModal (present in app/layout.tsx) via useModal().
 * Files requiring auth are fetched with chatService.getAuthHeaders() (JWT from session).
 *
 * @returns `openFilePreview(params)` — call this to open the modal
 *
 * @example
 * ```tsx
 * // From a cases page:
 * const { openFilePreview } = useFilePreview();
 * openFilePreview({ src: fileUrl, name: 'evidence.pdf', mimeType: 'application/pdf' });
 *
 * // From chat (ArtifactsPanel):
 * const { openFilePreview } = useFilePreview();
 * openFilePreview({
 *   src: chatService.getArtifactUrl(artifact.id),
 *   name: artifact.original_filename,
 *   mimeType: artifact.mime_type,
 * });
 * ```
 */
export function useFilePreview() {
  const { openModal } = useModal();

  /**
   * Open a file preview modal.
   *
   * Determines appropriate modal size from mimeType, then renders FilePreviewModalView
   * inside the global Modal container. Supports image, video, audio, PDF, text,
   * Word/Excel/PPT (download card), and unknown file types.
   *
   * @param params.src - The URL to fetch the file from (authenticated blob fetch internally)
   * @param params.name - Display filename
   * @param params.mimeType - MIME type to determine viewer type
   * @param params.fileSize - File size in bytes for display
   * @param params.localPreviewUrl - Pre-loaded blob URL to skip network fetch
   */
  const openFilePreview = useCallback(
    async (params: OpenFilePreviewParams) => {
      const category = getFileCategory(params.mimeType, params.name);
      const customSize = MODAL_SIZE_MAP[category] ?? '800px';
      const artifactId = params.artifactId ?? extractArtifactIdFromSrc(params.src);

      debugLog.preview('Opening file preview', {
        name: params.name,
        mimeType: params.mimeType,
        category,
        customSize,
        hasLocalUrl: !!params.localPreviewUrl,
      });

      // WHY: Lazy import to avoid circular dependency and reduce initial bundle size.
      // FilePreviewModalView is a large component (1400+ lines) with multiple viewers.
      const { default: FilePreviewModalView } = await import('@/app/shared/ai-chat/file-preview-modal');

      openModal({
        view: (
          <FilePreviewModalView
            src={params.src}
            name={params.name}
            mimeType={params.mimeType ?? null}
            fileSize={params.fileSize ?? null}
            localPreviewUrl={params.localPreviewUrl}
            artifactId={artifactId}
            initialCurrentTime={params.initialCurrentTime}
            initialIsPlaying={params.initialIsPlaying}
            meta={params.meta}
            onLivePlaybackSync={params.onLivePlaybackSync}
            onPlaybackSync={params.onPlaybackSync}
            mediaSessionId={params.mediaSessionId}
            initialShowWaveform={params.initialShowWaveform}
          />
        ),
        customSize,
      });
    },
    [openModal]
  );

  return { openFilePreview };
}
