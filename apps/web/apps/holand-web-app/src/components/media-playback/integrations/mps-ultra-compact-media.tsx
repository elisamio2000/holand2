'use client';

import { useCallback, useEffect, type ReactNode } from 'react';
import cn from '@core/utils/class-names';
import VideoPlayer from '@/components/video-player';
import {
  MediaElementHost,
  MediaPreviewPlaceholder,
  MpsInlineAudioPlayer,
  type MpsInlineAudioExpandPayload,
  useMediaPreview,
} from '@/components/media-playback';
import { useFilePreview } from '@/hooks/use-file-preview';

export interface MpsFilePreviewParams {
  src: string;
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
  artifactId?: string;
  localPreviewUrl?: string;
  initialShowWaveform?: boolean;
  initialCurrentTime?: number;
}

/** Open global file preview modal with optional MPS handoff. */
export function useMpsExpandFilePreview() {
  const { openFilePreview } = useFilePreview();

  const openWithHandoff = useCallback(
    (mediaSessionId: string, params: MpsFilePreviewParams) => {
      if (!mediaSessionId) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[MPS] useMpsExpandFilePreview: session not ready — expand blocked');
        }
        return;
      }
      openFilePreview({ ...params, mediaSessionId });
    },
    [openFilePreview]
  );

  const openWithExpand = useCallback(
    (
      media: { sessionId: string; expandToModal: () => void },
      params: MpsFilePreviewParams
    ) => {
      if (!media.sessionId) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('[MPS] useMpsExpandFilePreview: session not ready — expand blocked');
        }
        openFilePreview(params);
        return;
      }
      media.expandToModal();
      openFilePreview({ ...params, mediaSessionId: media.sessionId });
    },
    [openFilePreview]
  );

  return { openWithHandoff, openWithExpand };
}

export interface MpsUltraCompactAudioProps {
  src?: string;
  artifactId?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  title: string;
  localPreviewUrl?: string | null;
  className?: string;
  rowId?: string;
  stickyEnabled?: boolean;
  onDownload?: () => void;
  onSessionReady?: (mediaSessionId: string) => void;
}

/** Messenger-style ultraCompact audio row with MPS + modal expand. */
export function MpsUltraCompactAudio({
  src,
  artifactId,
  mimeType,
  fileSize,
  title,
  localPreviewUrl,
  className,
  rowId,
  stickyEnabled = true,
  onDownload,
  onSessionReady,
}: MpsUltraCompactAudioProps) {
  const { openWithHandoff } = useMpsExpandFilePreview();

  const handleExpand = useCallback(
    (payload: MpsInlineAudioExpandPayload) => {
      openWithHandoff(payload.mediaSessionId, {
        src: src ?? payload.src ?? '',
        name: payload.name,
        mimeType: payload.mimeType,
        fileSize: payload.fileSize,
        artifactId: payload.artifactId ?? artifactId,
        localPreviewUrl: localPreviewUrl ?? undefined,
        initialShowWaveform: payload.showWaveform,
      });
    },
    [openWithHandoff, src, artifactId, localPreviewUrl]
  );

  return (
    <MpsInlineAudioPlayer
      artifactId={artifactId}
      src={src}
      localPreviewUrl={localPreviewUrl}
      mimeType={mimeType}
      fileSize={fileSize}
      title={title}
      variant="ultraCompact"
      className={className}
      stickySessionId={rowId ?? artifactId ?? src ?? title}
      stickyEnabled={stickyEnabled}
      sessionKey={rowId ?? artifactId ?? src ?? title}
      onSessionReady={onSessionReady}
      onRequestExpand={handleExpand}
    />
  );
}

export interface MpsUltraCompactVideoProps {
  src: string;
  artifactId?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  title: string;
  poster?: string;
  rowId: string;
  className?: string;
  localPreviewUrl?: string | null;
  inlinePlaybackActive?: boolean;
  onInlinePlaybackRequest?: () => void;
  onDownload?: () => void;
  thumbnailSlot?: ReactNode;
  onSessionReady?: (mediaSessionId: string) => void;
  /** Override default modal expand (e.g. One Search watch page navigation). */
  onRowPreview?: () => void;
  /** ultraCompact inline expansion mode — `mini` for related-video sidebar rows. */
  playbackMode?: 'preview' | 'inline' | 'mini';
}

/** Messenger-style ultraCompact video row with MPS + modal expand. */
export function MpsUltraCompactVideo({
  src,
  artifactId,
  mimeType,
  fileSize,
  title,
  poster,
  rowId,
  className,
  localPreviewUrl,
  inlinePlaybackActive,
  onInlinePlaybackRequest,
  onDownload,
  thumbnailSlot,
  onSessionReady,
  onRowPreview,
  playbackMode = 'preview',
}: MpsUltraCompactVideoProps) {
  const { openWithExpand } = useMpsExpandFilePreview();
  const playbackArtifactId = localPreviewUrl ? undefined : artifactId;
  const ready = Boolean(playbackArtifactId || localPreviewUrl || src);

  const videoMedia = useMediaPreview({
    enabled: ready,
    kind: 'video',
    src,
    artifactId: playbackArtifactId,
    mimeType,
    fileSize,
    title,
    blobUrl: localPreviewUrl ?? undefined,
    sessionKey: rowId,
  });

  const openExpand = useCallback(() => {
    if (!videoMedia.sessionId) return;
    openWithExpand(videoMedia, {
      src,
      name: title,
      mimeType,
      fileSize,
      artifactId,
      localPreviewUrl: localPreviewUrl ?? undefined,
    });
  }, [openWithExpand, videoMedia, src, title, mimeType, fileSize, artifactId, localPreviewUrl]);

  useEffect(() => {
    if (videoMedia.sessionId) onSessionReady?.(videoMedia.sessionId);
  }, [videoMedia.sessionId, onSessionReady]);

  if (!ready || !videoMedia.sessionId) {
    return null;
  }

  return (
    <div className={cn('min-w-0', className)}>
      <MediaElementHost
        sessionId={videoMedia.sessionId}
        kind="video"
        src={videoMedia.playbackSrc}
        className="hidden"
      />
      {!videoMedia.isModal ? (
        <VideoPlayer
          variant="ultraCompact"
          src={videoMedia.playbackSrc ?? src}
          title={title}
          mimeType={mimeType ?? undefined}
          fileSize={fileSize ?? undefined}
          artifactId={playbackArtifactId}
          poster={poster}
          thumbnailSlot={thumbnailSlot}
          rowId={rowId}
          mediaSessionId={videoMedia.sessionId}
          inlinePlaybackActive={inlinePlaybackActive}
          onInlinePlaybackRequest={onInlinePlaybackRequest}
          onRowPreview={onRowPreview ?? openExpand}
          onDownload={onDownload}
          playbackMode={playbackMode}
        />
      ) : (
        <MediaPreviewPlaceholder sessionId={videoMedia.sessionId} kind="video" title={title} />
      )}
    </div>
  );
}
