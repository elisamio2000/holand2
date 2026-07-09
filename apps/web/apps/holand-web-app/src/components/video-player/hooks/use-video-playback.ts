import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { detectVideoFormat } from '../engine/format-detector';
import { createVideoEngine } from '../engine/video-engine';
import { captureVideoScreenshot } from '../utils/screenshot';
import { useVideoSettings } from './use-video-settings';
import {
  applyActiveSubtitleMode,
  syncSubtitleTracks,
} from '../utils/sync-subtitle-tracks';
import { useVideoPlayerSessionStore } from '../store/video-player-session-store';
import { useMediaSession, mediaSessionController, useMediaSessionStore, videoEngineRegistry } from '@/components/media-playback';
import { ownsPresentationChrome as resolveOwnsPresentationChrome } from '@/components/media-playback/core/owns-presentation-chrome';
import { warnDualMediaOwnership } from '@/components/media-playback/core/dev-invariants';
import { requestVideoPiP } from './use-video-pip';
import type {
  EngineState,
  UseVideoPlaybackReturn,
  VideoChapter,
  VideoPlayerProps,
  VideoPlayerSettings,
  VideoPlayerVariant,
  VideoSource,
  VideoSubtitleTrack,
} from '../types';
import type { MediaPlaybackSession } from '@/components/media-playback';

const INITIAL_ENGINE_STATE: EngineState = {
  levels: [],
  activeLevelId: 'auto',
  autoLevel: true,
  audioTracks: [],
  activeAudioTrackId: null,
  isLive: false,
};

const MODAL_CHROME_VARIANTS = new Set<VideoPlayerVariant>(['expanded', 'full', 'advanced', 'pip']);

function isModalChromeVariant(variant?: VideoPlayerVariant): boolean {
  return variant ? MODAL_CHROME_VARIANTS.has(variant) : false;
}

/** Inline ↔ modal handoff — keep session engine alive in registry. */
function isEngineHandoff(
  mediaSessionId: string | undefined,
  variant: VideoPlayerVariant | undefined,
  session: MediaPlaybackSession | undefined
): boolean {
  if (!mediaSessionId || !session) return false;
  if (variant === 'chatInline' && session.presentation.primary === 'modal') return true;
  if (isModalChromeVariant(variant) && session.presentation.primary === 'inline') return true;
  return false;
}

function syncUiFromVideo(
  video: HTMLVideoElement,
  session: MediaPlaybackSession | undefined,
  setters: {
    setCurrentTime: (t: number) => void;
    setIsPlaying: (p: boolean) => void;
    setDuration: (d: number) => void;
    setStatus: (s: UseVideoPlaybackReturn['status']) => void;
  }
): void {
  setters.setCurrentTime(video.currentTime);
  setters.setIsPlaying(!video.paused);
  const dur =
    session && session.duration > 0
      ? session.duration
      : Number.isFinite(video.duration)
        ? video.duration
        : 0;
  if (dur > 0) setters.setDuration(dur);
  setters.setStatus(video.paused ? 'paused' : 'playing');
}

export function useVideoPlayback(props: VideoPlayerProps): UseVideoPlaybackReturn {
  const {
    src,
    mimeType,
    sources,
    initialCurrentTime,
    initialIsPlaying,
    onMediaStateChange,
    syncVideoRef,
    mediaSessionId,
    controlsRef,
    mirrorPlayback,
    volume: controlledVolume,
    playbackRate: controlledRate,
    isMuted: controlledMuted,
    onSettingsChange,
    chapters: chaptersProp,
    subtitles: subtitlesProp,
    onChaptersLoad,
    onSubtitlesLoad,
    onUnsupportedFormat,
    duration: durationProp,
    poster,
    title,
    artifactId,
    variant,
  } = props;

  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Awaited<ReturnType<typeof createVideoEngine>> | null>(null);
  /** Monotonic token guarding against StrictMode double-attach races on the shared video element. */
  const attachSeqRef = useRef(0);
  const hasInitialized = useRef(false);
  const [isFocused, setIsFocused] = useState(false);

  const mpsSession = useMediaSession(mediaSessionId);
  const sessionVideoRef = mpsSession?.elementRef;
  const videoRef = (
    mediaSessionId && sessionVideoRef ? sessionVideoRef : syncVideoRef ?? internalVideoRef
  ) as RefObject<HTMLVideoElement>;

  const [status, setStatus] = useState<UseVideoPlaybackReturn['status']>('idle');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationProp ?? 0);
  const [buffered, setBuffered] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const presentationPrimary = mpsSession?.presentation.primary;

  useEffect(() => {
    warnDualMediaOwnership(
      'VideoPlayer',
      Boolean(mediaSessionId),
      Boolean(syncVideoRef?.current)
    );
  }, [mediaSessionId, syncVideoRef]);

  useEffect(() => {
    if (!mediaSessionId || !mpsSession) return;
    setCurrentTime(mpsSession.currentTime);
    setIsPlaying(mpsSession.isPlaying);
    if (mpsSession.duration > 0) setDuration(mpsSession.duration);
    if (mpsSession.lifecycle === 'playing' || mpsSession.isPlaying) {
      setStatus('playing');
    } else if (mpsSession.status === 'loading') {
      setStatus('loading');
    } else if (mpsSession.status === 'ready') {
      setStatus('paused');
    }
    hasInitialized.current = true;
  }, [
    mediaSessionId,
    mpsSession?.currentTime,
    mpsSession?.isPlaying,
    mpsSession?.duration,
    mpsSession?.lifecycle,
    mpsSession?.status,
    presentationPrimary,
  ]);

  const [loadedChapters, setLoadedChapters] = useState<VideoChapter[]>(chaptersProp ?? []);
  const [loadedSubtitles, setLoadedSubtitles] = useState<VideoSubtitleTrack[]>(subtitlesProp ?? []);
  const [activeSubtitleId, setActiveSubtitleId] = useState<string | null>(
    subtitlesProp?.find((s) => s.default)?.id ?? null
  );
  const [activeQuality, setActiveQuality] = useState<string | undefined>();
  const [engineState, setEngineState] = useState<EngineState>(INITIAL_ENGINE_STATE);
  /** Bumped by retry() to force the engine attach effect to re-run. */
  const [retryNonce, setRetryNonce] = useState(0);

  const {
    volume,
    playbackRate,
    isMuted,
    loop,
    settings,
    emitSettingsChange: emitSettings,
  } = useVideoSettings({
    volume: controlledVolume,
    playbackRate: controlledRate,
    isMuted: controlledMuted,
    onSettingsChange,
  });

  const settingsWithExtras = useMemo<VideoPlayerSettings>(
    () => ({
      ...settings,
      quality: activeQuality ?? settings.quality,
      activeSubtitleId,
    }),
    [settings, activeQuality, activeSubtitleId]
  );

  const detection = useMemo(() => detectVideoFormat(src, mimeType), [src, mimeType]);

  const activeSource = useMemo<VideoSource | null>(() => {
    if (sources?.length) {
      const byQuality = sources.find((s) => s.quality === activeQuality);
      return byQuality ?? sources[0];
    }
    return { src, type: mimeType, quality: activeQuality };
  }, [sources, activeQuality, src, mimeType]);

  const applyVideoSettings = useCallback(
    (video: HTMLVideoElement) => {
      video.volume = volume;
      video.muted = isMuted;
      video.playbackRate = playbackRate;
      video.loop = loop;
    },
    [volume, isMuted, playbackRate, loop]
  );

  /** Latest prefs for engine attach without re-triggering attach on every settings change. */
  const settingsSnapshotRef = useRef({ volume, isMuted, playbackRate, loop });
  settingsSnapshotRef.current = { volume, isMuted, playbackRate, loop };

  // Load chapters/subtitles async
  useEffect(() => {
    if (chaptersProp) setLoadedChapters(chaptersProp);
  }, [chaptersProp]);

  useEffect(() => {
    if (subtitlesProp) setLoadedSubtitles(subtitlesProp);
  }, [subtitlesProp]);

  useEffect(() => {
    if (!onChaptersLoad) return;
    void onChaptersLoad()
      .then(setLoadedChapters)
      .catch(() => {});
  }, [onChaptersLoad]);

  useEffect(() => {
    if (!onSubtitlesLoad) return;
    void onSubtitlesLoad()
      .then(setLoadedSubtitles)
      .catch(() => {});
  }, [onSubtitlesLoad]);

  // Inject/sync `<track>` elements (shared video + reparent paths)
  useEffect(() => {
    if (mirrorPlayback) return;
    const video = videoRef.current;
    if (!video || loadedSubtitles.length === 0) return;
    void syncSubtitleTracks(video, loadedSubtitles, activeSubtitleId);
  }, [videoRef, loadedSubtitles, activeSubtitleId, mirrorPlayback]);

  // Engine attach — skip in mirror mode or until a playable src is available
  useEffect(() => {
    if (mirrorPlayback) return;
    if (!resolveOwnsPresentationChrome(mediaSessionId, mpsSession, variant)) return;

    const video = videoRef.current;
    const sourceSrc = activeSource?.src;
    const sourceType = activeSource?.type;
    const playableSrc = sourceSrc?.trim();
    if (!video || !playableSrc) {
      setStatus('idle');
      setErrorMessage(undefined);
      return;
    }

    if (detection.strategy === 'unsupported') {
      setStatus('unsupported');
      onUnsupportedFormat?.(detection.format, mimeType);
      return;
    }

    const existingEngine =
      mediaSessionId && videoEngineRegistry.has(mediaSessionId)
        ? (videoEngineRegistry.get(mediaSessionId) as Awaited<ReturnType<typeof createVideoEngine>>)
        : null;

    if (existingEngine) {
      engineRef.current = existingEngine;
      setEngineState(existingEngine.getState());
      syncUiFromVideo(video, mpsSession, {
        setCurrentTime,
        setIsPlaying,
        setDuration,
        setStatus,
      });
      return () => {
        const session = mediaSessionId
          ? useMediaSessionStore.getState().getSession(mediaSessionId)
          : undefined;
        if (isEngineHandoff(mediaSessionId, variant, session)) return;
        if (mediaSessionId) videoEngineRegistry.clear(mediaSessionId);
        if (engineRef.current === existingEngine) engineRef.current = null;
      };
    }

    // WHY: React StrictMode (dev) double-invokes effects. A sequence token makes
    // sure a superseded/abandoned engine never claims the shared <video> element
    // nor wipes the live engine's src. Each run owns exactly the engine it created.
    const seq = ++attachSeqRef.current;
    let localEngine: Awaited<ReturnType<typeof createVideoEngine>> | null = null;
    const resumeTime = video.currentTime;
    const resumePlaying = !video.paused;
    setStatus('loading');
    setErrorMessage(undefined);
    setEngineState(INITIAL_ENGINE_STATE);

    void (async () => {
      try {
        const strat = sourceSrc !== src
          ? detectVideoFormat(playableSrc, sourceType).strategy
          : detection.strategy;

        const engine = await createVideoEngine({
          video,
          src: playableSrc,
          strategy: strat,
          onError: (msg) => {
            if (seq === attachSeqRef.current) {
              setStatus('error');
              setErrorMessage(msg);
            }
          },
          onStateChange: (s) => {
            if (seq === attachSeqRef.current) setEngineState(s);
          },
        });
        // A newer attach already took over the shared element — discard this one.
        if (seq !== attachSeqRef.current) {
          engine.destroy();
          return;
        }
        localEngine = engine;
        engineRef.current = engine;
        if (mediaSessionId) videoEngineRegistry.set(mediaSessionId, engine);
        const prefs = settingsSnapshotRef.current;
        video.volume = prefs.volume;
        video.muted = prefs.isMuted;
        video.playbackRate = prefs.playbackRate;
        video.loop = prefs.loop;
        if (resumeTime > 0 && Number.isFinite(resumeTime)) {
          video.currentTime = resumeTime;
        }
        if (resumePlaying) {
          void video.play().catch(() => {});
        }
        syncUiFromVideo(video, mpsSession, {
          setCurrentTime,
          setIsPlaying,
          setDuration,
          setStatus,
        });
      } catch {
        if (seq === attachSeqRef.current) {
          setStatus('error');
          setErrorMessage('load');
        }
      }
    })();

    return () => {
      const session = mediaSessionId
        ? useMediaSessionStore.getState().getSession(mediaSessionId)
        : undefined;
      if (isEngineHandoff(mediaSessionId, variant, session)) {
        if (engineRef.current === localEngine) engineRef.current = null;
        return;
      }
      if (mediaSessionId) {
        videoEngineRegistry.clear(mediaSessionId);
      } else {
        localEngine?.destroy();
      }
      if (engineRef.current === localEngine) engineRef.current = null;
    };
  }, [
    activeSource?.src,
    detection.strategy,
    mirrorPlayback,
    mimeType,
    onUnsupportedFormat,
    videoRef,
    src,
    retryNonce,
    activeSource?.type,
    detection.format,
    mediaSessionId,
    mpsSession,
    variant,
    presentationPrimary,
  ]);

  // Video event listeners
  useEffect(() => {
    if (mirrorPlayback) {
      setCurrentTime(mirrorPlayback.currentTime);
      setIsPlaying(mirrorPlayback.isPlaying);
      setStatus(mirrorPlayback.isPlaying ? 'playing' : 'paused');
      if (durationProp) setDuration(durationProp);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    const onLoaded = () => {
      setDuration(video.duration || durationProp || 0);
      setStatus(video.paused ? 'paused' : 'playing');
      setIsPlaying(!video.paused);
      if (!hasInitialized.current) {
        if (!mediaSessionId && initialCurrentTime && initialCurrentTime > 0) {
          video.currentTime = initialCurrentTime;
        }
        if (!mediaSessionId && initialIsPlaying) {
          // Respect autoplay policies: if a non-muted play() is blocked,
          // retry muted so playback still starts (common on mobile/Safari).
          void video.play().catch(() => {
            video.muted = true;
            void video.play().catch(() => {});
          });
        }
        hasInitialized.current = true;
      }
    };

    const onTime = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        setBuffered(video.buffered.end(video.buffered.length - 1));
      }
      if (mediaSessionId && !video.paused) {
        mediaSessionController.syncFromElement(mediaSessionId);
      }
      onMediaStateChange?.(video.currentTime, !video.paused);
    };

    const onPlay = () => {
      setIsPlaying(true);
      setStatus('playing');
      if (mediaSessionId) mediaSessionController.syncFromElement(mediaSessionId);
      onMediaStateChange?.(video.currentTime, true);
    };

    const onPause = () => {
      setIsPlaying(false);
      setStatus('paused');
      if (mediaSessionId) mediaSessionController.syncFromElement(mediaSessionId);
      onMediaStateChange?.(video.currentTime, false);
    };

    const onWaiting = () => setStatus('loading');
    const onCanPlay = () => {
      if (!video.paused) setStatus('playing');
      else setStatus('paused');
    };

    const onError = () => {
      setStatus('error');
      setErrorMessage('decode');
    };

    video.addEventListener('loadedmetadata', onLoaded);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('error', onError);

    if (video.readyState >= 1) onLoaded();

    return () => {
      video.removeEventListener('loadedmetadata', onLoaded);
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('error', onError);
    };
  }, [
    videoRef,
    mirrorPlayback,
    initialCurrentTime,
    initialIsPlaying,
    onMediaStateChange,
    durationProp,
    mediaSessionId,
  ]);

  // Apply settings to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || mirrorPlayback) return;
    applyVideoSettings(video);
  }, [applyVideoSettings, videoRef, mirrorPlayback]);

  const play = useCallback(() => {
    if (mirrorPlayback) return;
    if (mediaSessionId) {
      mediaSessionController.play(mediaSessionId);
      return;
    }
    void videoRef.current?.play().catch(() => {});
  }, [videoRef, mirrorPlayback, mediaSessionId]);

  const pause = useCallback(() => {
    if (mirrorPlayback) return;
    if (mediaSessionId) {
      mediaSessionController.pause(mediaSessionId);
      return;
    }
    videoRef.current?.pause();
  }, [videoRef, mirrorPlayback, mediaSessionId]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || mirrorPlayback) return;
    if (mediaSessionId) {
      mediaSessionController.togglePlay(mediaSessionId);
      return;
    }
    if (v.paused) void v.play().catch(() => {});
    else v.pause();
  }, [videoRef, mirrorPlayback, mediaSessionId]);

  const seekTo = useCallback(
    (seconds: number) => {
      if (mirrorPlayback) return;
      if (mediaSessionId) {
        mediaSessionController.seek(mediaSessionId, seconds);
        return;
      }
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = Math.max(0, Math.min(v.duration || seconds, seconds));
      setCurrentTime(v.currentTime);
    },
    [videoRef, mirrorPlayback, mediaSessionId]
  );

  const setVolume = useCallback(
    (v: number) => {
      const vol = Math.max(0, Math.min(1, v));
      if (videoRef.current) videoRef.current.volume = vol;
      emitSettings({ volume: vol, isMuted: vol === 0 });
    },
    [emitSettings, videoRef]
  );

  const setMuted = useCallback(
    (m: boolean) => {
      if (videoRef.current) videoRef.current.muted = m;
      emitSettings({ isMuted: m });
    },
    [emitSettings, videoRef]
  );

  const setPlaybackRate = useCallback(
    (r: number) => {
      if (videoRef.current) videoRef.current.playbackRate = r;
      emitSettings({ playbackRate: r });
    },
    [emitSettings, videoRef]
  );

  const setLoop = useCallback(
    (l: boolean) => {
      if (videoRef.current) videoRef.current.loop = l;
      emitSettings({ loop: l });
    },
    [emitSettings, videoRef]
  );

  const setActiveSubtitle = useCallback(
    (id: string | null) => {
      setActiveSubtitleId(id);
      emitSettings({ activeSubtitleId: id });
      const video = videoRef.current;
      if (!video) return;
      applyActiveSubtitleMode(video, loadedSubtitles, id);
    },
    [emitSettings, loadedSubtitles, videoRef]
  );

  const setQuality = useCallback(
    (quality: string) => {
      setActiveQuality(quality);
      emitSettings({ quality });
    },
    [emitSettings]
  );

  const setLevel = useCallback(
    (id: string) => {
      engineRef.current?.setLevel(id);
      emitSettings({ quality: id });
    },
    [emitSettings]
  );

  const setAudioTrack = useCallback((id: string) => {
    engineRef.current?.setAudioTrack(id);
  }, []);

  const retry = useCallback(() => {
    hasInitialized.current = false;
    setStatus('loading');
    setErrorMessage(undefined);
    // Re-run the attach effect (which owns engine lifecycle + StrictMode-safe
    // sequencing) rather than spinning up an engine outside that flow.
    setRetryNonce((n) => n + 1);
  }, []);

  const takeScreenshot = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return null;
    return captureVideoScreenshot(video);
  }, [videoRef]);

  const requestFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    void (el.requestFullscreen?.() ?? (el as HTMLElement & { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen?.());
  }, []);

  const requestPiP = useCallback(async () => {
    const video = videoRef.current;
    if (mirrorPlayback) return;
    await requestVideoPiP(video, {
      mediaSessionId,
      src,
      poster,
      title,
      mimeType,
      artifactId,
      initialCurrentTime: video?.currentTime,
      initialIsPlaying: video ? !video.paused : undefined,
    });
  }, [videoRef, mirrorPlayback, mediaSessionId, src, mimeType, poster, title, artifactId]);

  // Imperative controlsRef
  useEffect(() => {
    if (!controlsRef) return;
    controlsRef.current = {
      play,
      pause,
      togglePlay,
      seekTo,
      getCurrentTime: () => videoRef.current?.currentTime ?? currentTime,
      getDuration: () => videoRef.current?.duration ?? duration,
      isPlaying: () => (videoRef.current ? !videoRef.current.paused : isPlaying),
      requestFullscreen,
      requestPiP,
      takeScreenshot,
    };
    return () => {
      controlsRef.current = null;
    };
  }, [
    controlsRef,
    play,
    pause,
    togglePlay,
    seekTo,
    currentTime,
    duration,
    isPlaying,
    requestFullscreen,
    requestPiP,
    takeScreenshot,
    videoRef,
  ]);

  return {
    status,
    currentTime,
    duration,
    buffered,
    isPlaying,
    volume,
    playbackRate,
    isMuted,
    loop,
    errorMessage,
    strategy: detection.strategy,
    detectedFormat: detection.format,
    play,
    pause,
    togglePlay,
    seekTo,
    setVolume,
    setMuted,
    setPlaybackRate,
    setLoop,
    setActiveSubtitle,
    setQuality,
    setLevel,
    setAudioTrack,
    retry,
    takeScreenshot,
    requestFullscreen,
    requestPiP,
    videoRef,
    containerRef,
    isFocused,
    setIsFocused,
    loadedChapters,
    loadedSubtitles,
    activeSubtitleId,
    activeSource,
    settings: settingsWithExtras,
    engineState,
    mirrorPlayback,
    usesExternalVideo: Boolean(mediaSessionId || syncVideoRef),
  };
}
