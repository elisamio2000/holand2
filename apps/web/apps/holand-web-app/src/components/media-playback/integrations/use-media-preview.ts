'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MediaKind, MediaViewFlags } from '../core/types';
import { useMediaSession, useMediaSessionStore } from '../core/media-session-store';
import { mediaSessionController } from '../core/media-session-controller';
import { warnMediaPreviewSourceWithoutKey } from '../core/dev-invariants';

export interface UseMediaPreviewOptions {
  kind: MediaKind;
  src?: string;
  artifactId?: string;
  mimeType?: string | null;
  fileSize?: number | null;
  title?: string;
  blobUrl?: string | null;
  initialView?: MediaViewFlags;
  /** When false, no session is created (non-media categories). */
  enabled?: boolean;
  /** When this value changes, the previous session is destroyed and a new one is created. */
  sessionKey?: string;
}

export interface UseMediaPreviewReturn {
  sessionId: string;
  session: ReturnType<typeof useMediaSession>;
  isModal: boolean;
  isInline: boolean;
  expandToModal: () => void;
  collapseToInline: () => void;
  setViewFlags: (flags: Partial<MediaViewFlags>) => void;
  playbackSrc: string | undefined;
}

/**
 * Integration hook for FilePreviewInline/Modal — one session, stable element.
 * Session creation runs in useEffect (never during render) to avoid Zustand update loops.
 */
export function useMediaPreview(options: UseMediaPreviewOptions): UseMediaPreviewReturn {
  const {
    kind,
    src,
    artifactId,
    mimeType,
    fileSize,
    title,
    blobUrl,
    initialView,
    enabled = true,
    sessionKey = '',
  } = options;

  const createSession = useMediaSessionStore((s) => s.createSession);
  const destroySession = useMediaSessionStore((s) => s.destroySession);
  const updateSession = useMediaSessionStore((s) => s.updateSession);
  const setViewFlagsStore = useMediaSessionStore((s) => s.setViewFlags);

  const [sessionId, setSessionId] = useState('');
  const effectiveSessionKey = sessionKey || `${kind}:${artifactId ?? src ?? ''}`;
  const prevIdentityRef = useRef({ key: effectiveSessionKey, src, artifactId });

  useEffect(() => {
    const prev = prevIdentityRef.current;
    if (
      prev.key === effectiveSessionKey &&
      (prev.src !== src || prev.artifactId !== artifactId) &&
      !sessionKey
    ) {
      warnMediaPreviewSourceWithoutKey(effectiveSessionKey, effectiveSessionKey, src);
    }
    prevIdentityRef.current = { key: effectiveSessionKey, src, artifactId };
  }, [effectiveSessionKey, sessionKey, src, artifactId]);

  useEffect(() => {
    if (!enabled) {
      setSessionId('');
      return;
    }

    const id = createSession({
      kind,
      src,
      artifactId,
      mimeType,
      fileSize,
      title,
      view: initialView,
    });
    setSessionId(id);

    return () => {
      destroySession(id);
      setSessionId('');
    };
  }, [enabled, effectiveSessionKey, kind, createSession, destroySession, src, artifactId, mimeType, fileSize, title, initialView]);

  useEffect(() => {
    if (!enabled || !sessionId) return;
    updateSession(sessionId, {
      kind,
      source: {
        src,
        artifactId,
        mimeType: mimeType ?? undefined,
        fileSize: fileSize ?? undefined,
        title,
      },
    });
  }, [enabled, sessionId, kind, src, artifactId, mimeType, fileSize, title, updateSession]);

  const session = useMediaSession(sessionId || undefined);
  const playbackSrc = blobUrl ?? src;

  const expandToModal = useCallback(() => {
    if (!enabled || !sessionId) return;
    mediaSessionController.expandToModal(sessionId);
  }, [enabled, sessionId]);

  const collapseToInline = useCallback(() => {
    if (!enabled || !sessionId) return;
    mediaSessionController.collapseToInline(sessionId);
  }, [enabled, sessionId]);

  const setViewFlags = useCallback(
    (flags: Partial<MediaViewFlags>) => {
      if (!enabled || !sessionId) return;
      setViewFlagsStore(sessionId, flags);
    },
    [enabled, sessionId, setViewFlagsStore]
  );

  const isModal = session?.presentation.primary === 'modal';
  const isInline = session?.presentation.primary === 'inline';

  return useMemo(
    () => ({
      sessionId,
      session,
      isModal,
      isInline,
      expandToModal,
      collapseToInline,
      setViewFlags,
      playbackSrc,
    }),
    [
      sessionId,
      session,
      isModal,
      isInline,
      expandToModal,
      collapseToInline,
      setViewFlags,
      playbackSrc,
    ]
  );
}
