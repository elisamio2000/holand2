'use client';

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import cn from '@core/utils/class-names';
import {
  AudioPlayer,
  type AudioPlayerControls,
  type AudioPlayerVariant,
  useAudioPlayerPrefs,
  useAudioStickyAnchor,
} from '@/components/audio-player';
import {
  MediaElementHost,
  MediaPreviewPlaceholder,
  useMediaPreview,
  useMediaStickyHandlers,
} from '@/components/media-playback';

export interface MpsInlineAudioExpandPayload {
  mediaSessionId: string;
  src?: string;
  artifactId?: string;
  name: string;
  mimeType?: string | null;
  fileSize?: number | null;
  blobUrl?: string | null;
  showWaveform: boolean;
}

export interface MpsInlineAudioPlayerProps {
  src?: string;
  artifactId?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  title?: string;
  blobUrl?: string | null;
  localPreviewUrl?: string | null;
  variant?: Extract<AudioPlayerVariant, 'chatInline' | 'compact' | 'ultraCompact'>;
  className?: string;
  stickySessionId?: string;
  stickyEnabled?: boolean;
  controlsRef?: MutableRefObject<AudioPlayerControls | null>;
  onMediaStateChange?: (currentTime: number, isPlaying: boolean) => void;
  onSessionReady?: (mediaSessionId: string) => void;
  onRequestExpand?: (payload: MpsInlineAudioExpandPayload) => void;
  showWaveform?: boolean;
  onShowWaveformChange?: (next: boolean) => void;
  sessionKey?: string;
}

/**
 * Canonical MPS + global AudioPlayer integration for inline surfaces
 * (markdown, message attachments, shared patterns outside FilePreviewInline).
 */
export function MpsInlineAudioPlayer({
  src,
  artifactId,
  mimeType,
  fileSize,
  title = 'Audio',
  blobUrl,
  localPreviewUrl,
  variant = 'chatInline',
  className,
  stickySessionId,
  stickyEnabled = false,
  controlsRef,
  onMediaStateChange,
  onSessionReady,
  onRequestExpand,
  showWaveform: showWaveformProp,
  onShowWaveformChange,
  sessionKey,
}: MpsInlineAudioPlayerProps) {
  const audioPrefs = useAudioPlayerPrefs();
  const anchorRef = useRef<HTMLDivElement>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [inlineShowWaveform, setInlineShowWaveform] = useState(showWaveformProp ?? false);

  const resolvedBlob = blobUrl ?? localPreviewUrl ?? null;
  const playbackArtifactId = localPreviewUrl ? undefined : artifactId;
  const playbackSrc = playbackArtifactId ? undefined : resolvedBlob ?? src;
  const ready = Boolean(playbackArtifactId || resolvedBlob || src);

  const audioMedia = useMediaPreview({
    enabled: ready,
    kind: 'audio',
    src,
    artifactId: playbackArtifactId,
    mimeType,
    fileSize,
    title,
    blobUrl: resolvedBlob ?? undefined,
    initialView: { showWaveform: inlineShowWaveform },
    sessionKey: sessionKey ?? artifactId ?? src ?? title,
  });

  const stickySid = stickySessionId ?? artifactId ?? src ?? title;

  const stickyHandlers = useMediaStickyHandlers({
    mediaSessionId: audioMedia.sessionId || undefined,
    fallback: {
      togglePlay: () => controlsRef?.current?.togglePlay(),
      seekTo: (time) => controlsRef?.current?.seekTo(time),
    },
  });

  useAudioStickyAnchor({
    enabled: stickyEnabled && audioPlaying && !audioMedia.isModal && Boolean(stickySid),
    sessionId: stickySid,
    anchorRef,
    anchorKey: stickySid,
    stickyLayout: audioPrefs.stickyLayout,
    handlers: stickyHandlers,
  });

  useEffect(() => {
    if (audioMedia.sessionId) onSessionReady?.(audioMedia.sessionId);
  }, [audioMedia.sessionId, onSessionReady]);

  useEffect(() => {
    const wf = audioMedia.session?.view.showWaveform;
    if (wf !== undefined) setInlineShowWaveform(wf);
  }, [audioMedia.session?.view.showWaveform]);

  useEffect(() => {
    if (showWaveformProp !== undefined) setInlineShowWaveform(showWaveformProp);
  }, [showWaveformProp]);

  const handleExpand = useCallback(() => {
    if (!audioMedia.sessionId || !onRequestExpand) return;
    audioMedia.expandToModal();
    onRequestExpand({
      mediaSessionId: audioMedia.sessionId,
      src,
      artifactId: playbackArtifactId,
      name: title,
      mimeType,
      fileSize,
      blobUrl: resolvedBlob ?? undefined,
      showWaveform: inlineShowWaveform,
    });
  }, [
    audioMedia,
    onRequestExpand,
    src,
    playbackArtifactId,
    title,
    mimeType,
    fileSize,
    resolvedBlob,
    inlineShowWaveform,
  ]);

  if (!ready || !audioMedia.sessionId) {
    return null;
  }

  return (
    <div ref={anchorRef} className={cn('min-w-0', className)}>
      <MediaElementHost
        sessionId={audioMedia.sessionId}
        kind="audio"
        src={audioMedia.playbackSrc}
      />
      {!audioMedia.isModal ? (
        <AudioPlayer
          artifactId={playbackArtifactId}
          src={playbackSrc}
          variant={variant}
          title={title}
          mediaSessionId={audioMedia.sessionId}
          showWaveform={inlineShowWaveform}
          onShowWaveformChange={(next) => {
            setInlineShowWaveform(next);
            audioMedia.setViewFlags({ showWaveform: next });
            onShowWaveformChange?.(next);
          }}
          controlsRef={controlsRef}
          sessionId={stickySid}
          stickyEnabled={stickyEnabled}
          stickyLayout={audioPrefs.stickyLayout}
          onMediaStateChange={(ct, ip) => {
            setAudioPlaying(ip);
            onMediaStateChange?.(ct, ip);
          }}
          onExpand={onRequestExpand ? handleExpand : undefined}
        />
      ) : (
        <MediaPreviewPlaceholder
          sessionId={audioMedia.sessionId}
          kind="audio"
          title={title}
        />
      )}
    </div>
  );
}
