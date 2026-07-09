'use client';

import { useEffect, useRef } from 'react';
import type { MediaKind } from '../core/types';
import { useMediaSessionStore } from '../core/media-session-store';
import { mediaSessionController } from '../core/media-session-controller';

export interface MediaElementHostProps {
  sessionId: string;
  kind: MediaKind;
  src?: string;
  className?: string;
}

function resolveMediaSrc(url: string): string {
  try {
    return new URL(url, typeof window !== 'undefined' ? window.location.href : url).href;
  } catch {
    return url;
  }
}

function attachSessionMediaListeners(
  sessionId: string,
  el: HTMLMediaElement,
  updateSession: ReturnType<typeof useMediaSessionStore.getState>['updateSession']
): () => void {
  const onLoadedMetadata = () => {
    updateSession(sessionId, {
      status: 'ready',
      lifecycle: 'ready',
      duration: Number.isFinite(el.duration) ? el.duration : 0,
      currentTime: el.currentTime,
    });
  };
  const onTimeUpdate = () => mediaSessionController.syncFromElement(sessionId);
  const onPlay = () => {
    const session = useMediaSessionStore.getState().getSession(sessionId);
    if (!session) return;
    if (session.kind === 'audio' && session.activeVisual === 'wavesurfer') {
      return;
    }
    updateSession(sessionId, { lifecycle: 'playing', isPlaying: true });
  };
  const onPause = () => {
    const session = useMediaSessionStore.getState().getSession(sessionId);
    if (!session) return;
    if (session.kind === 'audio' && session.activeVisual === 'wavesurfer') {
      return;
    }
    updateSession(sessionId, {
      lifecycle: 'paused',
      isPlaying: false,
      currentTime: el.currentTime,
    });
  };
  const onEnded = () => {
    updateSession(sessionId, { lifecycle: 'paused', isPlaying: false });
  };

  el.addEventListener('loadedmetadata', onLoadedMetadata);
  el.addEventListener('timeupdate', onTimeUpdate);
  el.addEventListener('play', onPlay);
  el.addEventListener('pause', onPause);
  el.addEventListener('ended', onEnded);

  if (el.readyState >= 1) onLoadedMetadata();

  return () => {
    el.removeEventListener('loadedmetadata', onLoadedMetadata);
    el.removeEventListener('timeupdate', onTimeUpdate);
    el.removeEventListener('play', onPlay);
    el.removeEventListener('pause', onPause);
    el.removeEventListener('ended', onEnded);
  };
}

/**
 * Stable HTMLMediaElement for a session — survives inline ↔ modal chrome moves.
 * Video uses imperative DOM so React reconciliation never pulls the node back
 * from an external stage (VideoSurface reparent).
 */
export function MediaElementHost({ sessionId, kind, src, className }: MediaElementHostProps) {
  const elementRef = useRef<HTMLMediaElement | null>(null);
  const videoMountRef = useRef<HTMLDivElement | null>(null);
  const bindElementRef = useMediaSessionStore((s) => s.bindElementRef);
  const updateSession = useMediaSessionStore((s) => s.updateSession);

  // Video — create once outside React's video fiber tree.
  useEffect(() => {
    if (kind !== 'video') return;
    const mount = videoMountRef.current;
    if (!mount) return;

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.playsInline = true;
    video.setAttribute('aria-label', 'Video playback');
    if (src) video.src = resolveMediaSrc(src);
    if (className) video.className = className;
    mount.appendChild(video);
    elementRef.current = video;
    bindElementRef(sessionId, elementRef);
    updateSession(sessionId, { status: 'loading' });

    const detachListeners = attachSessionMediaListeners(sessionId, video, updateSession);

    return () => {
      detachListeners();
      video.remove();
      elementRef.current = null;
      bindElementRef(sessionId, { current: null });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one element per session
  }, [sessionId, kind]);

  useEffect(() => {
    if (kind !== 'video') return;
    const video = elementRef.current;
    if (!video || !src) return;
    const target = resolveMediaSrc(src);
    const current = video.currentSrc || video.src;
    if (current !== target) {
      video.src = target;
    }
    if (className) video.className = className;
  }, [kind, src, className]);

  // Audio — declarative hidden element (no external reparent).
  useEffect(() => {
    if (kind !== 'audio') return;
    bindElementRef(sessionId, elementRef);
    updateSession(sessionId, { status: 'loading' });
    return () => {
      bindElementRef(sessionId, { current: null });
    };
  }, [sessionId, kind, bindElementRef, updateSession]);

  useEffect(() => {
    if (kind !== 'audio') return;
    const el = elementRef.current;
    if (!el) return;
    return attachSessionMediaListeners(sessionId, el, updateSession);
  }, [sessionId, kind, src, updateSession]);

  if (kind === 'video') {
    return (
      <div
        ref={videoMountRef}
        className="contents"
        data-mps-video-host={sessionId}
      />
    );
  }

  return (
    <audio
      ref={elementRef as React.RefObject<HTMLAudioElement>}
      src={src}
      preload="metadata"
      aria-label="Audio playback"
      className={className ?? 'hidden'}
    />
  );
}
