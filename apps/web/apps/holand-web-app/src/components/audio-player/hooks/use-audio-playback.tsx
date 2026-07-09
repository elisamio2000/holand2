'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useTheme } from 'next-themes';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin, {
  type Region,
} from 'wavesurfer.js/dist/plugins/regions.js';
import type { AudioPlayerProps, UseAudioPlaybackReturn } from '../types';
import { REGION_COLORS, ZOOM_LEVELS, variantUsesMainWaveSurfer } from '../constants';
import { formatTime } from '../utils/format-time';
import { audioBufferToWav } from '../utils/wav-export';
import { handlePlaybackFinish } from '../engine/playback-finish';
import { shouldSkipWaveSurferReinit } from '../engine/src-ref-guard';
import {
  bumpAttachSeq,
  destroyWaveSurferWithHandoff,
  isAttachStale,
  loadWaveSurferSrc,
  wireWaveSurferControls,
} from '../engine/audio-engine';
import { createInlineWaveSurfer, createMainWaveSurfer } from '../engine/wave-surfer-factory';
import { storageService } from '@/services/storage.service';
import { useAudioPlayerStore } from '../store/audio-player-store';
import { useAudioSettings } from './use-audio-settings';
import { useAudioSource } from './use-audio-source';
import {
  useMediaSession,
  useMediaSessionStore,
  mediaSessionController,
  isWsPlaybackOwner as checkWsPlaybackOwner,
  resolveHandoffSnapshot,
} from '@/components/media-playback';
import { ownsPresentationChrome as resolveOwnsPresentationChrome } from '@/components/media-playback/core/owns-presentation-chrome';
import { warnDualMediaOwnership } from '@/components/media-playback/core/dev-invariants';
import { createTogglePlayLock } from '../utils/toggle-play-lock';

export function useAudioPlayback(props: AudioPlayerProps): UseAudioPlaybackReturn {
  const {
    resolvedSrc,
    srcLoading,
    srcError,
    retrySrc,
  } = useAudioSource({
    src: props.src,
    artifactId: props.artifactId,
    playbackStrategy: props.playbackStrategy,
  });
  const {
    title,
  mimeType,
  fileSize,
  duration: durationProp,
  initialCurrentTime,
  initialIsPlaying,
  onMediaStateChange,
  onRegionChange,
  onRegionSelect,
  regions: externalRegions,
  controlsRef,
  onSeek,
  showWaveform: showWaveformProp,
  onShowWaveformChange,
  enableRegions = false,
  showTimeline = false,
  showVolume = true,
  showFileInfo = true,
  showShortcutsHint = true,
  showSkipButtons = true,
  showSpeedControl = true,
  showZoom = false,
  showSkipEnds = false,
  waveformHeight = 80,
  variant = 'full',
  progress,
  syncAudioRef,
  mirrorPlayback,
  mediaSessionId,
  className,
  waveColor: waveColorProp,
  progressColor: progressColorProp,
  showHeader = false,
  onExpand,
  onClose,
  onDownload,
  onShare,
  onDelete,
  onTrim,
  onAddMarker,
  moreMenuItems,
    isLooping: isLoopingProp,
    onSettingsChange,
    sessionId,
    artifactId,
    stickyEnabled,
    stickyLayout,
    ownsGlobalSession = true,
    } = props;
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const mpsSession = useMediaSession(mediaSessionId);
  const sessionSyncRef = mpsSession?.elementRef ?? undefined;
  const effectiveSyncRef = mediaSessionId && sessionSyncRef ? sessionSyncRef : syncAudioRef;

  const {
    volume,
    playbackRate,
    isMuted,
    isLooping,
    emitSettingsChange,
  } = useAudioSettings({
    volume: props.volume,
    playbackRate: props.playbackRate,
    isMuted: props.isMuted,
    isLooping: isLoopingProp,
    onSettingsChange,
  });

  const waveformRef = useRef<HTMLDivElement>(null);
  const inlineWaveformRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WaveSurfer | null>(null);
  const regionsRef = useRef<RegionsPlugin | null>(null);
  const dragSelectionCleanupRef = useRef<(() => void) | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    if (!mediaSessionId || !mpsSession) return;
    setCurrentTime(mpsSession.currentTime);
    setIsPlaying(mpsSession.isPlaying);
    if (mpsSession.duration > 0) setDuration(mpsSession.duration);
  }, [mediaSessionId, mpsSession]);

  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [activeRegion, setActiveRegion] = useState<Region | null>(null);
  const [userRegions, setUserRegions] = useState<Region[]>([]);
  const [isRegionMode, setIsRegionMode] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loadRetryKey, setLoadRetryKey] = useState(0);
  /** True only after WaveSurfer 'ready' — separate from HTML-audio isReady */
  const [wsAudioReady, setWsAudioReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(50);
  const [showVolumePopup, setShowVolumePopup] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [internalShowWaveform, setInternalShowWaveform] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const togglePlayLock = useRef(createTogglePlayLock());
  const isLoopingRef = useRef(false);
  isLoopingRef.current = isLooping;

  const lastMediaSyncAtRef = useRef(0);
  const syncMediaStateThrottled = useCallback(
    (time: number, playing: boolean) => {
      if (mediaSessionId) {
        const session = useMediaSessionStore.getState().getSession(mediaSessionId);
        if (session?.activeVisual === 'wavesurfer') {
          mediaSessionController.patchPlaybackFromWs(
            mediaSessionId,
            time,
            playing,
            wsRef.current?.getDuration()
          );
        } else {
          mediaSessionController.syncFromElement(mediaSessionId);
        }
      }
      if (!onMediaStateChange || !playing) return;
      const now = Date.now();
      if (now - lastMediaSyncAtRef.current < 250) return;
      lastMediaSyncAtRef.current = now;
      onMediaStateChange(time, playing);
    },
    [onMediaStateChange, mediaSessionId]
  );

  const registerMpsRemoteControls = useCallback(() => {
    if (!mediaSessionId || !controlsRef) return;
    const c = controlsRef.current;
    const store = useMediaSessionStore.getState();
    if (!c) {
      store.clearRemoteControls(mediaSessionId);
      return;
    }
    store.registerRemoteControls(mediaSessionId, {
      play: () => c.play(),
      pause: () => c.pause(),
      togglePlay: () => c.togglePlay(),
      seekTo: (seconds: number) => c.seekTo(seconds),
      getCurrentTime: () => c.getCurrentTime(),
      getDuration: () => c.getDuration(),
      isPlaying: () => c.isPlaying(),
      setVolume: (v: number) => {
        mediaSessionController.setVolume(mediaSessionId, v);
        emitSettingsChange({ volume: v, isMuted: v === 0 });
      },
    });
  }, [mediaSessionId, controlsRef, emitSettingsChange]);

  const showWaveform =
    showWaveformProp !== undefined
      ? showWaveformProp
      : variant === 'full' || variant === 'advanced'
        ? true
        : internalShowWaveform;
  const showWaveformRef = useRef(showWaveform);
  showWaveformRef.current = showWaveform;

  const initialTimeRef = useRef(initialCurrentTime);
  const initialPlayingRef = useRef(initialIsPlaying);
  initialTimeRef.current = initialCurrentTime;
  initialPlayingRef.current = initialIsPlaying;

  const applyWsZoom = useCallback((level: number) => {
    if (!wsRef.current || !wsAudioReady || !variantUsesMainWaveSurfer(variant)) return;
    try {
      wsRef.current.zoom(level);
    } catch {
      /* WaveSurfer throws if decode not finished */
    }
  }, [wsAudioReady, variant]);

  /** WS bound to session MediaElementHost — play/pause must not fight the same node. */
  const isWsBoundToSharedMedia = useCallback(() => {
    const shared = effectiveSyncRef?.current;
    const wsMedia = wsRef.current?.getMediaElement?.() ?? null;
    return Boolean(shared && wsMedia && shared === wsMedia);
  }, [effectiveSyncRef]);

  const pauseSharedAudio = useCallback(() => {
    if (isWsBoundToSharedMedia()) return;
    effectiveSyncRef?.current?.pause();
    if (!effectiveSyncRef?.current) fallbackAudioRef.current?.pause();
  }, [effectiveSyncRef, isWsBoundToSharedMedia]);

  const pauseWaveSurfer = useCallback(() => {
    if (isWsBoundToSharedMedia()) return;
    try {
      wsRef.current?.pause();
    } catch {
      /* ignore */
    }
  }, [isWsBoundToSharedMedia]);

  const isWsPlaybackOwner = useCallback(() => {
    return checkWsPlaybackOwner({
      wsReady: Boolean(wsRef.current && wsAudioReady),
      showWaveform,
      variant,
      mirrorPlayback: Boolean(mirrorPlayback),
    });
  }, [wsAudioReady, mirrorPlayback, variant, showWaveform]);

  /** @deprecated use isWsPlaybackOwner */
  const isWaveSurferActive = isWsPlaybackOwner;

  const ownsPresentationChrome = resolveOwnsPresentationChrome(
    mediaSessionId,
    mpsSession,
    variant
  );

  useEffect(() => {
    warnDualMediaOwnership(
      'AudioPlayer',
      Boolean(mediaSessionId),
      Boolean(syncAudioRef?.current)
    );
  }, [mediaSessionId, syncAudioRef]);

  /** Keep MPS activeVisual + remote controls aligned with WS vs HTML ownership. */
  useEffect(() => {
    if (!mediaSessionId || !ownsPresentationChrome) return;
    const wsActive = isWsPlaybackOwner();
    mediaSessionController.setActiveVisual(mediaSessionId, wsActive ? 'wavesurfer' : 'none');
    if (wsActive) {
      registerMpsRemoteControls();
    } else {
      useMediaSessionStore.getState().clearRemoteControls(mediaSessionId);
    }
  }, [
    mediaSessionId,
    ownsPresentationChrome,
    isWsPlaybackOwner,
    wsAudioReady,
    showWaveform,
    registerMpsRemoteControls,
  ]);

  const mainSrcRef = useRef<string>('');
  const inlineSrcRef = useRef<string>('');
  const destroyedRef = useRef(false);
  const handoffInProgressRef = useRef(false);
  const instanceIdRef = useRef(0);
  const fallbackAudioRef = useRef<HTMLAudioElement | null>(null);

  /** Active HTML audio — shared ref from parent or internal fallback */
  const getActiveAudio = useCallback((): HTMLAudioElement | null => {
    return effectiveSyncRef?.current ?? fallbackAudioRef.current;
  }, [effectiveSyncRef]);
  const sharedMediaElement = effectiveSyncRef?.current ?? null;

  const setShowWaveformVisible = useCallback(
    (next: boolean) => {
      onShowWaveformChange?.(next);
      if (showWaveformProp === undefined) setInternalShowWaveform(next);
    },
    [onShowWaveformChange, showWaveformProp]
  );

  /* Bidirectional controlled showWaveform sync */
  useEffect(() => {
    if (showWaveformProp !== undefined) {
      setInternalShowWaveform(showWaveformProp);
    }
  }, [showWaveformProp]);

  const needsFallbackAudio =
    !mirrorPlayback &&
    (variant === 'ultraCompact' ||
      variant === 'mini' ||
      variant === 'expanded' ||
      (variant === 'chatInline' && (!showWaveform || !wsAudioReady)) ||
      ((variant === 'full' || variant === 'advanced' || variant === 'compact') &&
        (!wsAudioReady || !showWaveform)));

  /* Sync controlled volume/speed/mute to active backends */
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume;
    if (wsRef.current && wsAudioReady) {
      wsRef.current.setVolume(effectiveVolume);
      wsRef.current.setPlaybackRate(playbackRate);
    }
    const audio = getActiveAudio();
    if (audio) {
      audio.volume = volume;
      audio.playbackRate = playbackRate;
      audio.muted = isMuted;
    }
  }, [volume, playbackRate, isMuted, getActiveAudio, wsAudioReady]);

  /* Sync loop flag to active HTML audio / WaveSurfer media element */
  useEffect(() => {
    const audio = getActiveAudio();
    if (audio) audio.loop = isLooping;
    try {
      const media = wsRef.current?.getMediaElement?.();
      if (media) media.loop = isLooping;
    } catch {
      /* WebAudio backend may not expose a loopable element */
    }
  }, [isLooping, getActiveAudio, wsAudioReady]);

  const handleRetryLoad = useCallback(() => {
    setLoadError(false);
    setIsReady(false);
    setWsAudioReady(false);
    mainSrcRef.current = '';
    inlineSrcRef.current = '';
    retrySrc();
    setLoadRetryKey((k) => k + 1);
  }, [retrySrc]);

  const registerSession = useAudioPlayerStore((s) => s.registerSession);
  const updateSession = useAudioPlayerStore((s) => s.updateSession);
  const clearSession = useAudioPlayerStore((s) => s.clearSession);

  useEffect(() => {
    if (!sessionId || !resolvedSrc) return;
    registerSession({
      activeId: sessionId,
      title,
      src: resolvedSrc,
      artifactId,
      isPlaying,
      currentTime,
      duration,
      stickyEnabled: Boolean(stickyEnabled),
      stickyLayout,
      mediaSessionId,
    });
  }, [
    sessionId,
    title,
    resolvedSrc,
    artifactId,
    isPlaying,
    currentTime,
    duration,
    stickyEnabled,
    stickyLayout,
    mediaSessionId,
    registerSession,
  ]);

  useEffect(() => {
    if (!sessionId || !ownsGlobalSession) return;
    return () => {
      if (useAudioPlayerStore.getState().session.activeId === sessionId) {
        clearSession();
      }
    };
  }, [sessionId, ownsGlobalSession, clearSession]);

  useEffect(() => {
    if (!sessionId) return;
    const ct = mediaSessionId && mpsSession ? mpsSession.currentTime : currentTime;
    const ip = mediaSessionId && mpsSession ? mpsSession.isPlaying : isPlaying;
    const dur = mediaSessionId && mpsSession && mpsSession.duration > 0 ? mpsSession.duration : duration;
    updateSession({ isPlaying: ip, currentTime: ct, duration: dur });
  }, [sessionId, isPlaying, currentTime, duration, updateSession, mediaSessionId, mpsSession]);

  const waveColor = waveColorProp ?? (isDark ? '#9ca3af' : '#94a3b8');
  const progressColor = progressColorProp ?? (isDark ? '#c58b34' : '#c28520');
  const cursorColor = isDark ? '#e5a040' : '#b07a1a';

  /* ---------------------------------------------------------------- */
  /*  Fallback audio element for non-WaveSurfer variants               */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!needsFallbackAudio || !resolvedSrc) return;

    const audio = getActiveAudio();
    if (!audio) return;

    const usingSharedAudio = Boolean(effectiveSyncRef?.current);

    if (usingSharedAudio && resolvedSrc && audio.getAttribute('src') !== resolvedSrc) {
      audio.src = resolvedSrc;
    }

    const applySharedHandoff = () => {
      if (mediaSessionId && usingSharedAudio) {
        setCurrentTime(audio.currentTime);
        setIsPlaying(!audio.paused);
        if (controlsRef) {
          controlsRef.current = {
            play: () => { audio.play().catch(() => {}); },
            pause: () => audio.pause(),
            togglePlay: () => { audio.paused ? audio.play().catch(() => {}) : audio.pause(); },
            seekTo: (seconds: number) => {
              audio.currentTime = Math.max(0, Math.min(audio.duration || 0, seconds));
            },
            getCurrentTime: () => audio.currentTime,
            getDuration: () => audio.duration || 0,
            isPlaying: () => !audio.paused,
          };
        }
        return;
      }
      const t = initialTimeRef.current;
      const shouldPlay = Boolean(initialPlayingRef.current);
      if (usingSharedAudio) {
        if (t != null && t >= 0) {
          try {
            audio.currentTime = t;
          } catch {
            /* seek may fail before metadata */
          }
        }
        if (shouldPlay && audio.paused) {
          audio.play().catch(() => {});
        } else if (!shouldPlay && !audio.paused) {
          audio.pause();
        }
      } else {
        if (t != null && t > 0) {
          audio.currentTime = t;
        }
        if (shouldPlay) {
          audio.play().catch(() => {});
        }
      }
      if (controlsRef) {
        controlsRef.current = {
          play: () => { audio.play().catch(() => {}); },
          pause: () => audio.pause(),
          togglePlay: () => { audio.paused ? audio.play().catch(() => {}) : audio.pause(); },
          seekTo: (seconds: number) => { audio.currentTime = Math.max(0, Math.min(audio.duration || 0, seconds)); },
          getCurrentTime: () => audio.currentTime,
          getDuration: () => audio.duration || 0,
          isPlaying: () => !audio.paused,
        };
      }
      setCurrentTime(audio.currentTime);
      setIsPlaying(!audio.paused);
    };

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsReady(true);
      applySharedHandoff();
    };
    const onTimeUpdate = () => {
      if (handoffInProgressRef.current) return;
      setCurrentTime(audio.currentTime);
      if (!audio.paused) {
        syncMediaStateThrottled(audio.currentTime, true);
      }
    };
    const onPlay = () => {
      if (handoffInProgressRef.current) return;
      pauseWaveSurfer();
      setIsPlaying(true);
      onMediaStateChange?.(audio.currentTime, true);
    };
    const onPause = () => {
      if (handoffInProgressRef.current) return;
      setCurrentTime(audio.currentTime);
      setIsPlaying(false);
      onMediaStateChange?.(audio.currentTime, false);
    };
    const onEnded = () => {
      handlePlaybackFinish(isLoopingRef.current, {
        restart: () => {
          audio.currentTime = 0;
          audio.play().catch(() => {});
        },
        stop: () => setIsPlaying(false),
      });
    };
    const onVolumeChange = () => {
      emitSettingsChange({ volume: audio.volume, isMuted: audio.muted });
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('volumechange', onVolumeChange);

    if (audio.readyState >= 1) {
      onLoadedMetadata();
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('volumechange', onVolumeChange);
      if (!usingSharedAudio) {
        audio.pause();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc, needsFallbackAudio, variant, getActiveAudio]);

  /* ---------------------------------------------------------------- */
  /*  Initialize WaveSurfer                                           */
  /* ---------------------------------------------------------------- */

  useEffect(() => {
    if (!variantUsesMainWaveSurfer(variant)) return;
    if (!waveformRef.current || !resolvedSrc || srcLoading) return;
    const existingMainMedia = wsRef.current?.getMediaElement?.() ?? null;
    const mainNeedsSharedRebind =
      Boolean(sharedMediaElement) && existingMainMedia !== sharedMediaElement;
    if (
      shouldSkipWaveSurferReinit(mainSrcRef.current, resolvedSrc, Boolean(wsRef.current)) &&
      !mainNeedsSharedRebind
    ) {
      return;
    }

    mainSrcRef.current = resolvedSrc;
    destroyedRef.current = false;
    const myInstanceId = bumpAttachSeq(instanceIdRef);

    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch (_) { /* swallow destroy errors */ }
      wsRef.current = null;
      regionsRef.current = null;
    }

    setIsReady(false);
    setWsAudioReady(false);
    const sharedAtInit = effectiveSyncRef?.current;
    const initSnapshot = resolveHandoffSnapshot(mediaSessionId, sharedAtInit);
    const handoffTime =
      mediaSessionId
        ? initSnapshot.currentTime
        : sharedAtInit && sharedAtInit.currentTime > 0
          ? sharedAtInit.currentTime
          : !mediaSessionId && initialCurrentTime != null && initialCurrentTime > 0
            ? initialCurrentTime
            : 0;
    const handoffPlaying =
      mediaSessionId
        ? initSnapshot.isPlaying
        : (!mediaSessionId && Boolean(initialIsPlaying)) ||
          (sharedAtInit ? !sharedAtInit.paused : false);
    if (handoffTime > 0 || handoffPlaying) {
      setCurrentTime(handoffTime);
      setIsPlaying(handoffPlaying);
    } else {
      setCurrentTime(0);
      setIsPlaying(false);
    }
    setActiveRegion(null);
    setUserRegions([]);
    setDuration(0);
    setLoadError(false);

    const isStale = () => isAttachStale(instanceIdRef, myInstanceId);

    const computedHeight = variant === 'compact' ? 40 : waveformHeight;

    const ws = createMainWaveSurfer({
      container: waveformRef.current,
      height: computedHeight,
      waveColor,
      progressColor,
      cursorColor,
      enableRegions,
      showTimeline,
      timelineContainer: timelineRef.current,
      isDark,
      regionsRef,
      src: resolvedSrc,
      media: sharedMediaElement,
    });

    wsRef.current = ws;

    ws.on('error', (err: Error) => {
      if (isStale() || destroyedRef.current) return;
      console.warn('[AudioPlayer] WaveSurfer load error:', err.message);
      setLoadError(true);
      setIsReady(false);
      setWsAudioReady(false);
    });

    ws.on('ready', () => {
      if (isStale() || destroyedRef.current) return;
      setLoadError(false);
      setWsAudioReady(true);
      setIsReady(true);
      const dur = ws.getDuration();
      setDuration(dur);
      ws.setVolume(volume);

      wireWaveSurferControls(ws, controlsRef);
      registerMpsRemoteControls();

      const handoffHtmlToWs = () => {
        const extAudio = effectiveSyncRef?.current;
        if (!extAudio) return;
        const dur = ws.getDuration();
        const { currentTime: storeTime, isPlaying: shouldPlay } = resolveHandoffSnapshot(
          mediaSessionId,
          extAudio
        );
        extAudio.pause();
        if (storeTime > 0 && dur > 0) ws.seekTo(storeTime / dur);
        if (shouldPlay) void ws.play().catch(() => {});
      };

      if (!showWaveformRef.current) {
        /* Preload only — seek-bar mode keeps HTML as the active engine */
        ws.pause();
        return;
      }

      if (effectiveSyncRef?.current) {
        handoffHtmlToWs();
      } else if (!mediaSessionId && initialCurrentTime && initialCurrentTime > 0) {
        if (initialCurrentTime > 0 && dur > 0) {
          ws.seekTo(initialCurrentTime / dur);
        }
        if (initialIsPlaying) {
          ws.play();
        }
      }
    });

    ws.on('timeupdate', (time: number) => {
      if (isStale() || destroyedRef.current || handoffInProgressRef.current) return;
      setCurrentTime(time);
      try {
        if (ws.isPlaying()) syncMediaStateThrottled(time, true);
      } catch {
        /* ignore */
      }
    });

    ws.on('play', () => {
      if (isStale() || destroyedRef.current || handoffInProgressRef.current) return;
      pauseSharedAudio();
      setIsPlaying(true);
      const t = ws.getCurrentTime();
      syncMediaStateThrottled(t, true);
      onMediaStateChange?.(t, true);
    });

    ws.on('pause', () => {
      if (isStale() || destroyedRef.current || handoffInProgressRef.current) return;
      const t = ws.getCurrentTime();
      if (effectiveSyncRef?.current) {
        try {
          effectiveSyncRef.current.currentTime = t;
        } catch {
          /* sync for PiP mirror */
        }
      }
      setCurrentTime(t);
      setIsPlaying(false);
      syncMediaStateThrottled(t, false);
      onMediaStateChange?.(t, false);
    });

    ws.on('finish', () => {
      if (isStale() || destroyedRef.current) return;
      handlePlaybackFinish(isLoopingRef.current, {
        restart: () => {
          ws.seekTo(0);
          void ws.play().catch(() => {});
        },
        stop: () => setIsPlaying(false),
      });
    });

    if (enableRegions && regionsRef.current) {
      const regions = regionsRef.current;

      dragSelectionCleanupRef.current = regions.enableDragSelection({
        color: REGION_COLORS[0],
      });

      regions.on('region-created', (region: Region) => {
        if (isStale()) return;
        setUserRegions((prev) => {
          const next = [...prev, region];
          emitRegionChange(next);
          return next;
        });
      });

      regions.on('region-updated', (region: Region) => {
        if (isStale()) return;
        setUserRegions((prev) => {
          const next = prev.map((r) => (r.id === region.id ? region : r));
          emitRegionChange(next);
          return next;
        });
      });

      regions.on('region-clicked', (region: Region, e: MouseEvent) => {
        if (isStale()) return;
        e.stopPropagation();
        setActiveRegion(region);
        onRegionSelect?.({
          id: region.id,
          start: region.start,
          end: region.end,
          color: region.color,
          label: region.content?.textContent ?? undefined,
        });
        region.play();
      });
    }

    if (!sharedMediaElement) {
      loadWaveSurferSrc(ws, resolvedSrc, destroyedRef);
    }

    return () => {
      destroyWaveSurferWithHandoff({
        ws,
        destroyedRef,
        handoffInProgressRef,
        controlsRef,
        syncAudioRef: effectiveSyncRef,
        onMediaStateChange,
      });
      wsRef.current = null;
      regionsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc, variant, pauseSharedAudio, loadRetryKey, sharedMediaElement, srcLoading]);

  /* chatInline: WaveSurfer stays mounted; visibility toggles via CSS */
  useEffect(() => {
    if (variant !== 'chatInline' || mirrorPlayback) return;

    if (!inlineWaveformRef.current || !resolvedSrc || srcLoading) return;
    const existingInlineMedia = wsRef.current?.getMediaElement?.() ?? null;
    const inlineNeedsSharedRebind =
      Boolean(sharedMediaElement) && existingInlineMedia !== sharedMediaElement;
    if (
      shouldSkipWaveSurferReinit(inlineSrcRef.current, resolvedSrc, Boolean(wsRef.current)) &&
      !inlineNeedsSharedRebind
    ) {
      return;
    }

    inlineSrcRef.current = resolvedSrc;
    destroyedRef.current = false;
    const myInstanceId = bumpAttachSeq(instanceIdRef);

    if (wsRef.current) {
      try { wsRef.current.destroy(); } catch { /* ignore */ }
      wsRef.current = null;
    }

    setIsReady(false);
    setWsAudioReady(false);
    setLoadError(false);

    const isStale = () => isAttachStale(instanceIdRef, myInstanceId);

    const ws = createInlineWaveSurfer({
      container: inlineWaveformRef.current,
      src: resolvedSrc,
      waveColor,
      progressColor,
      cursorColor,
      media: sharedMediaElement,
    });

    wsRef.current = ws;

    ws.on('error', (err: Error) => {
      if (isStale() || destroyedRef.current) return;
      console.warn('[AudioPlayer] Inline WaveSurfer load error:', err.message);
      setLoadError(true);
      setIsReady(false);
      setWsAudioReady(false);
    });

    ws.on('ready', () => {
      if (isStale() || destroyedRef.current) return;
      setLoadError(false);
      setWsAudioReady(true);
      setIsReady(true);
      setDuration(ws.getDuration());
      ws.setVolume(isMuted ? 0 : volume);
      ws.setPlaybackRate(playbackRate);

      wireWaveSurferControls(ws, controlsRef);
      registerMpsRemoteControls();

      const handoffHtmlToWs = () => {
        const extAudio = effectiveSyncRef?.current;
        if (!extAudio) return;
        const dur = ws.getDuration();
        const { currentTime: storeTime, isPlaying: shouldPlay } = resolveHandoffSnapshot(
          mediaSessionId,
          extAudio
        );
        extAudio.pause();
        if (storeTime > 0 && dur > 0) ws.seekTo(storeTime / dur);
        if (shouldPlay) void ws.play().catch(() => {});
      };

      if (!showWaveformRef.current) {
        /* Preload only — seek-bar mode keeps HTML audio as the active engine */
        ws.pause();
        return;
      }

      if (effectiveSyncRef?.current) {
        handoffHtmlToWs();
      } else if (!mediaSessionId && initialCurrentTime && initialCurrentTime > 0) {
        const dur = ws.getDuration();
        if (dur > 0) ws.seekTo(initialCurrentTime / dur);
        if (initialIsPlaying) void ws.play().catch(() => {});
      }
    });

    ws.on('timeupdate', (time: number) => {
      if (isStale() || destroyedRef.current || handoffInProgressRef.current) return;
      setCurrentTime(time);
      try {
        if (ws.isPlaying()) syncMediaStateThrottled(time, true);
      } catch {
        /* ignore */
      }
    });

    ws.on('play', () => {
      if (isStale() || destroyedRef.current) return;
      pauseSharedAudio();
      setIsPlaying(true);
      const t = ws.getCurrentTime();
      syncMediaStateThrottled(t, true);
    });

    ws.on('pause', () => {
      if (isStale() || destroyedRef.current) return;
      const t = ws.getCurrentTime();
      setCurrentTime(t);
      setIsPlaying(false);
      syncMediaStateThrottled(t, false);
      onMediaStateChange?.(t, false);
    });

    ws.on('finish', () => {
      if (isStale() || destroyedRef.current) return;
      handlePlaybackFinish(isLoopingRef.current, {
        restart: () => {
          ws.seekTo(0);
          void ws.play().catch(() => {});
        },
        stop: () => setIsPlaying(false),
      });
    });

    if (!sharedMediaElement) {
      loadWaveSurferSrc(ws, resolvedSrc, destroyedRef);
    }

    return () => {
      destroyedRef.current = true;
      try { ws.destroy(); } catch { /* ignore */ }
      if (wsRef.current === ws) wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, resolvedSrc, mirrorPlayback, loadRetryKey, pauseSharedAudio, srcLoading, sharedMediaElement]);

  /* Keep seek-bar mode ready when WaveSurfer is preload-only */
  useEffect(() => {
    if (mirrorPlayback || showWaveform || !wsAudioReady) return;
    const seekBarVariant =
      variant === 'chatInline' ||
      variant === 'full' ||
      variant === 'advanced' ||
      variant === 'compact';
    if (!seekBarVariant) return;
    const shared = effectiveSyncRef?.current;
    if (shared && shared.readyState >= 1) setIsReady(true);
  }, [variant, showWaveform, wsAudioReady, mirrorPlayback, effectiveSyncRef]);

  /** Handoff HTML ↔ WaveSurfer when showWaveform toggles */
  const prevShowWaveformRef = useRef(showWaveform);
  useEffect(() => {
    if (mirrorPlayback) return;
    const supportsToggle =
      variant === 'chatInline' ||
      variant === 'full' ||
      variant === 'advanced' ||
      variant === 'compact';
    if (!supportsToggle) return;

    const prev = prevShowWaveformRef.current;
    if (prev === showWaveform) return;
    prevShowWaveformRef.current = showWaveform;

    const audio = getActiveAudio();
    const ws = wsRef.current;
    if (!ws || !wsAudioReady || !audio) return;

    handoffInProgressRef.current = true;
    if (showWaveform) {
      const dur = ws.getDuration();
      const { currentTime: t, isPlaying: wasPlaying } = resolveHandoffSnapshot(
        mediaSessionId,
        audio
      );
      if (dur > 0) ws.seekTo(t / dur);
      audio.pause();
      if (wasPlaying) void ws.play().catch(() => {});
      if (mediaSessionId) mediaSessionController.setActiveVisual(mediaSessionId, 'wavesurfer');
      registerMpsRemoteControls();
    } else {
      const t = ws.getCurrentTime();
      const wasPlaying = isPlaying || ws.isPlaying();
      ws.pause();
      audio.currentTime = t;
      if (wasPlaying) void audio.play().catch(() => {});
      if (mediaSessionId) mediaSessionController.setActiveVisual(mediaSessionId, 'none');
    }
    handoffInProgressRef.current = false;
  }, [
    variant,
    mirrorPlayback,
    showWaveform,
    wsAudioReady,
    getActiveAudio,
    isPlaying,
    mediaSessionId,
    registerMpsRemoteControls,
  ]);

  /* Sync theme colors */
  useEffect(() => {
    if (!wsRef.current) return;
    wsRef.current.setOptions({
      waveColor: waveColorProp ?? (isDark ? '#9ca3af' : '#94a3b8'),
      progressColor: progressColorProp ?? (isDark ? '#c58b34' : '#c28520'),
      cursorColor: isDark ? '#e5a040' : '#b07a1a',
    });
  }, [isDark, waveColorProp, progressColorProp]);

  /* Reapply zoom when waveform becomes visible again (full/advanced only) */
  useEffect(() => {
    if (!showWaveform || !showZoom || !wsAudioReady) return;
    applyWsZoom(zoomLevel);
  }, [showWaveform, showZoom, zoomLevel, wsAudioReady, applyWsZoom]);

  /* Sync external regions */
  useEffect(() => {
    if (!regionsRef.current || !externalRegions || !isReady) return;
    regionsRef.current.clearRegions();
    externalRegions.forEach((r, i) => {
      regionsRef.current?.addRegion({
        id: r.id,
        start: r.start,
        end: r.end,
        color: r.color ?? REGION_COLORS[i % REGION_COLORS.length],
        content: r.label,
        drag: enableRegions,
        resize: enableRegions,
      });
    });
  }, [externalRegions, isReady, enableRegions]);

  /* ---------------------------------------------------------------- */
  /*  Helpers                                                         */
  /* ---------------------------------------------------------------- */

  const emitRegionChange = useCallback(
    (regs: Region[]) => {
      onRegionChange?.(
        regs.map((r) => ({
          id: r.id,
          start: r.start,
          end: r.end,
          color: r.color,
          label: r.content?.textContent ?? undefined,
        }))
      );
    },
    [onRegionChange]
  );

  const seekToSeconds = useCallback(
    (seconds: number) => {
      if (mediaSessionId && ownsPresentationChrome) {
        mediaSessionController.seek(mediaSessionId, seconds);
        return;
      }
      if (wsRef.current && isWaveSurferActive()) {
        const dur = wsRef.current.getDuration();
        if (dur > 0) wsRef.current.seekTo(Math.max(0, Math.min(1, seconds / dur)));
        return;
      }
      const a = getActiveAudio();
      if (a) {
        a.currentTime = Math.max(0, Math.min(a.duration || 0, seconds));
      }
    },
    [getActiveAudio, isWaveSurferActive, mediaSessionId, ownsPresentationChrome]
  );

  const togglePlay = useCallback(() => {
    togglePlayLock.current.run(() => {
      if (mediaSessionId && ownsPresentationChrome) {
        mediaSessionController.togglePlay(mediaSessionId);
        return;
      }
      if (isWaveSurferActive()) {
        pauseSharedAudio();
        wsRef.current!.playPause();
      } else {
        pauseWaveSurfer();
        const a = getActiveAudio();
        if (a) a.paused ? a.play().catch(() => {}) : a.pause();
      }
    });
  }, [getActiveAudio, isWaveSurferActive, pauseSharedAudio, pauseWaveSurfer, mediaSessionId, ownsPresentationChrome]);

  const skipBack = useCallback(() => {
    const base =
      wsRef.current && isWaveSurferActive()
        ? wsRef.current.getCurrentTime()
        : getActiveAudio()?.currentTime ?? currentTime;
    seekToSeconds(Math.max(0, base - 10));
  }, [seekToSeconds, getActiveAudio, isWaveSurferActive, currentTime]);

  const skipForward = useCallback(() => {
    const dur =
      wsRef.current && isWaveSurferActive()
        ? wsRef.current.getDuration()
        : getActiveAudio()?.duration ?? duration;
    const base =
      wsRef.current && isWaveSurferActive()
        ? wsRef.current.getCurrentTime()
        : getActiveAudio()?.currentTime ?? currentTime;
    seekToSeconds(Math.min(dur || 0, base + 10));
  }, [seekToSeconds, getActiveAudio, isWaveSurferActive, currentTime, duration]);

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      const nextMuted = val === 0;
      if (wsRef.current) wsRef.current.setVolume(nextMuted ? 0 : val);
      const a = getActiveAudio();
      if (a) {
        a.volume = val;
        a.muted = nextMuted;
      }
      emitSettingsChange({ volume: val, isMuted: nextMuted });
    },
    [getActiveAudio, emitSettingsChange]
  );

  const toggleMute = useCallback(() => {
    const a = getActiveAudio();
    const nextMuted = !isMuted;
    if (nextMuted) {
      if (wsRef.current) wsRef.current.setVolume(0);
      else if (a) a.muted = true;
    } else {
      if (wsRef.current) wsRef.current.setVolume(volume || 0.8);
      else if (a) { a.muted = false; a.volume = volume || 0.8; }
    }
    emitSettingsChange({ isMuted: nextMuted });
  }, [isMuted, volume, getActiveAudio, emitSettingsChange]);

  const handleSpeedChange = useCallback((speed: number) => {
    if (wsRef.current) wsRef.current.setPlaybackRate(speed);
    else {
      const a = getActiveAudio();
      if (a) a.playbackRate = speed;
    }
    emitSettingsChange({ playbackRate: speed });
    setShowSpeedMenu(false);
  }, [getActiveAudio, emitSettingsChange]);

  const toggleLoop = useCallback(() => {
    emitSettingsChange({ isLooping: !isLooping });
  }, [emitSettingsChange, isLooping]);

  const skipToStart = useCallback(() => {
    seekToSeconds(0);
    setCurrentTime(0);
  }, [seekToSeconds]);

  const skipToEnd = useCallback(() => {
    const dur =
      wsRef.current && isWaveSurferActive()
        ? wsRef.current.getDuration()
        : getActiveAudio()?.duration ?? duration;
    seekToSeconds(dur || 0);
  }, [seekToSeconds, getActiveAudio, isWaveSurferActive, duration]);

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => {
      const next = ZOOM_LEVELS.find((z) => z > prev) ?? prev;
      applyWsZoom(next);
      return next;
    });
  }, [applyWsZoom]);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const next = [...ZOOM_LEVELS].reverse().find((z) => z < prev) ?? prev;
      applyWsZoom(next);
      return next;
    });
  }, [applyWsZoom]);

  const toggleRegionMode = useCallback(() => {
    setIsRegionMode((prev) => {
      const next = !prev;
      if (regionsRef.current) {
        if (next) {
          dragSelectionCleanupRef.current = regionsRef.current.enableDragSelection({
            color: REGION_COLORS[userRegions.length % REGION_COLORS.length],
          });
        } else if (dragSelectionCleanupRef.current) {
          dragSelectionCleanupRef.current();
          dragSelectionCleanupRef.current = null;
        }
      }
      return next;
    });
  }, [userRegions.length]);

  const clearRegions = useCallback(() => {
    regionsRef.current?.clearRegions();
    setUserRegions([]);
    setActiveRegion(null);
    onRegionChange?.([]);
    onRegionSelect?.(null);
  }, [onRegionChange, onRegionSelect]);

  const removeActiveRegion = useCallback(() => {
    if (!activeRegion) return;
    activeRegion.remove();
    setUserRegions((prev) => {
      const next = prev.filter((r) => r.id !== activeRegion.id);
      emitRegionChange(next);
      return next;
    });
    setActiveRegion(null);
    onRegionSelect?.(null);
  }, [activeRegion, emitRegionChange, onRegionSelect]);

  const downloadRegion = useCallback(async () => {
    if (!activeRegion || !wsRef.current) return;
    const audioCtx = new AudioContext();
    let arrayBuffer: ArrayBuffer;
    if (artifactId) {
      const blob = await storageService.fetchArtifactBlob(artifactId, 'inline');
      arrayBuffer = await blob.arrayBuffer();
    } else {
      const response = await fetch(resolvedSrc);
      arrayBuffer = await response.arrayBuffer();
    }
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const sampleRate = audioBuffer.sampleRate;
    const startSample = Math.floor(activeRegion.start * sampleRate);
    const endSample = Math.floor(activeRegion.end * sampleRate);
    const length = endSample - startSample;

    const offlineCtx = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      length,
      sampleRate
    );
    const source = offlineCtx.createBufferSource();
    const trimmedBuffer = offlineCtx.createBuffer(
      audioBuffer.numberOfChannels,
      length,
      sampleRate
    );

    for (let ch = 0; ch < audioBuffer.numberOfChannels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      trimmedBuffer.copyToChannel(channelData.slice(startSample, endSample), ch);
    }

    source.buffer = trimmedBuffer;
    source.connect(offlineCtx.destination);
    source.start();

    const rendered = await offlineCtx.startRendering();
    const wav = audioBufferToWav(rendered);
    const blob = new Blob([wav], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `region_${formatTime(activeRegion.start)}-${formatTime(activeRegion.end)}.wav`;
    a.click();
    URL.revokeObjectURL(url);
    audioCtx.close();
  }, [activeRegion, resolvedSrc, artifactId]);

  const effectiveLoadError = loadError || srcError;

  const fallbackAudioEl = needsFallbackAudio && resolvedSrc && !effectiveSyncRef ? (
    <audio ref={fallbackAudioRef} src={resolvedSrc} preload="metadata" className="hidden" />
  ) : null;

  const isExpanded = variant === 'expanded';
  const isAdvanced = variant === 'advanced';
  const effectiveShowWaveform = isExpanded ? false : showWaveform;
  const usesMainWs = variantUsesMainWaveSurfer(variant);

  return {
    resolvedSrc,
    srcLoading,
    srcError,
    retrySrc: handleRetryLoad,
    variant,
    title,
    mimeType,
    fileSize,
    durationProp,
    className,
    showHeader,
    showFileInfo,
    showVolume,
    showSkipButtons,
    showSpeedControl,
    showZoom,
    showSkipEnds,
    showShortcutsHint,
    showTimeline,
    enableRegions,
    waveformHeight,
    progress,
    mirrorPlayback,
    syncAudioRef: effectiveSyncRef,
    onSeek,
    onExpand,
    onClose,
    onDownload,
    onShare,
    onDelete,
    onTrim,
    onAddMarker,
    moreMenuItems,
    isDark,
    isReady,
    wsAudioReady,
    isPlaying,
    currentTime,
    duration,
    volume,
    playbackRate,
    isMuted,
    isLooping,
    showWaveform,
    setShowWaveformVisible,
    loadError: effectiveLoadError,
    handleRetryLoad,
    zoomLevel,
    zoomIn,
    zoomOut,
    isRegionMode,
    toggleRegionMode,
    userRegions,
    activeRegion,
    removeActiveRegion,
    downloadRegion,
    clearRegions,
    showSpeedMenu,
    setShowSpeedMenu,
    showMoreMenu,
    setShowMoreMenu,
    showVolumePopup,
    setShowVolumePopup,
    togglePlay,
    skipBack,
    skipForward,
    skipToStart,
    skipToEnd,
    seekToSeconds,
    handleVolumeChange,
    toggleMute,
    handleSpeedChange,
    toggleLoop,
    isWsPlaybackOwner,
    isWaveSurferActive,
    getActiveAudio,
    wsRef,
    waveformRef,
    inlineWaveformRef,
    timelineRef,
    containerRef,
    setIsFocused,
    isFocused,
    fallbackAudioEl,
    waveColor,
    progressColor,
    effectiveShowWaveform,
    isExpanded,
    isAdvanced,
    variantUsesMainWaveSurfer: usesMainWs,
  };
}
