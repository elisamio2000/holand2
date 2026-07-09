'use client';

import { useEffect, useRef, useState } from 'react';
import { warnDualMediaOwnership } from '@/components/media-playback/core/dev-invariants';
import { useVideoPlayback } from './hooks/use-video-playback';
import { useVideoKeyboard } from './hooks/use-video-keyboard';
import { UltraCompactVariant } from './variants/ultra-compact';
import { CompactVariant } from './variants/compact';
import { ChatInlineVariant } from './variants/chat-inline';
import { ExpandedVariant } from './variants/expanded';
import { FullVariant } from './variants/full';
import { AdvancedVariant } from './variants/advanced';
import { PiPVariant } from './variants/pip';
import type { VideoPlayerProps } from './types';

export type { VideoPlayerProps, VideoPlayerControls, VideoChapter, VideoSubtitleTrack, VideoSource, VideoPlayerSettings } from './types';

export function VideoPlayer(props: VideoPlayerProps) {
  const { variant = 'expanded', mirrorPlayback, playbackMode = 'preview', mediaSessionId, syncVideoRef } = props;

  warnDualMediaOwnership('VideoPlayer', Boolean(mediaSessionId), Boolean(syncVideoRef));

  const [rowInlineActive, setRowInlineActive] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const inlineActive = props.inlinePlaybackActive ?? rowInlineActive;
  const deferEngine =
    variant === 'ultraCompact' &&
    (playbackMode === 'preview' ||
      ((playbackMode === 'inline' || playbackMode === 'mini') && !inlineActive));
  const playbackProps = deferEngine ? { ...props, src: '' } : props;

  const playback = useVideoPlayback(playbackProps);
  useVideoKeyboard(playback, variant !== 'ultraCompact');

  useEffect(() => {
    if (mirrorPlayback) return;
    if (variant === 'expanded' || variant === 'full' || variant === 'advanced') {
      const id = requestAnimationFrame(() => {
        playback.containerRef.current?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(id);
    }
  }, [variant, mirrorPlayback, playback.containerRef]);

  useEffect(() => {
    if (variant !== 'ultraCompact' || (playbackMode !== 'inline' && playbackMode !== 'mini') || !inlineActive || mirrorPlayback) return;
    if (playback.status === 'paused') {
      void playback.play();
      return;
    }
    const t = window.setTimeout(() => {
      void playback.play();
    }, 150);
    return () => window.clearTimeout(t);
  }, [variant, playbackMode, inlineActive, mirrorPlayback, playback.status, playback.play, playback]);

  useEffect(() => {
    if (variant !== 'ultraCompact' || (playbackMode !== 'inline' && playbackMode !== 'mini') || !inlineActive || mirrorPlayback) return;
    const el = rowRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          playback.pause();
          setRowInlineActive(false);
        }
      },
      { threshold: 0.15, rootMargin: '0px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [variant, playbackMode, inlineActive, mirrorPlayback, playback.pause, playback]);

  const variantProps = {
    ...props,
    playback,
    inlinePlaybackActive: inlineActive,
    onInlinePlaybackRequest: () => {
      props.onInlinePlaybackRequest?.();
      setRowInlineActive(true);
    },
  };

  switch (variant) {
    case 'ultraCompact':
      return (
        <div ref={rowRef} className="min-w-0">
          <UltraCompactVariant {...variantProps} />
        </div>
      );
    case 'compact':
      return <CompactVariant {...variantProps} />;
    case 'chatInline':
      return <ChatInlineVariant {...variantProps} />;
    case 'expanded':
      return <ExpandedVariant {...variantProps} />;
    case 'full':
      return <FullVariant {...variantProps} />;
    case 'advanced':
      return <AdvancedVariant {...variantProps} />;
    case 'pip':
      return <PiPVariant {...variantProps} />;
    default:
      return <ExpandedVariant {...variantProps} />;
  }
}

export default VideoPlayer;
