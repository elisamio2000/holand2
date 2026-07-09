import type Hls from 'hls.js';
import type { MediaPlayerClass } from 'dashjs';
import type {
  EngineState,
  PlaybackStrategy,
  VideoAudioTrack,
  VideoQualityLevel,
} from '../types';

export interface VideoEngineOptions {
  video: HTMLVideoElement;
  src: string;
  strategy: PlaybackStrategy;
  /** Fatal/unrecoverable errors only — recoverable ones are retried internally. */
  onError?: (message: string) => void;
  /** Emitted whenever levels / audio tracks / live state change. */
  onStateChange?: (state: EngineState) => void;
}

export interface VideoEngineHandle {
  destroy: () => void;
  switchSrc: (src: string, strategy: PlaybackStrategy) => void;
  /** Select a quality level by id, or 'auto' to enable ABR. */
  setLevel: (id: string) => void;
  /** Select an audio track by id. */
  setAudioTrack: (id: string) => void;
  getState: () => EngineState;
}

/**
 * Minimal structural view of the dash.js v5 player API we rely on. Declared
 * locally so the engine is decoupled from exact dash.js type signatures
 * (which differ between major versions).
 */
interface DashRepresentation {
  id?: string;
  index?: number;
  width?: number;
  height?: number;
  bitrateInKbit?: number;
  bandwidth?: number;
}
interface DashMediaInfo {
  id?: string | number;
  index?: number;
  lang?: string | null;
  labels?: Array<{ text?: string }>;
}
interface DashLike {
  getRepresentationsByType: (type: string) => DashRepresentation[];
  getCurrentRepresentationForType: (type: string) => DashRepresentation | null;
  setRepresentationForTypeByIndex: (type: string, index: number, forceReplace?: boolean) => void;
  getTracksFor: (type: string) => DashMediaInfo[];
  setCurrentTrack: (track: unknown, noSettingsSave?: boolean) => void;
  isDynamic?: () => boolean;
  updateSettings: (settings: unknown) => void;
  on: (type: string, listener: (e: unknown) => void) => void;
}

const EMPTY_STATE: EngineState = {
  levels: [],
  activeLevelId: 'auto',
  autoLevel: true,
  audioTracks: [],
  activeAudioTrackId: null,
  isLive: false,
};

function qualityLabel(height?: number, bitrate?: number): string {
  if (height) return `${height}p`;
  if (bitrate) return `${Math.round(bitrate / 1000)} kbps`;
  return 'Auto';
}

/**
 * Creates a playback engine that abstracts native HTML5, HLS.js and dash.js.
 *
 * Beyond simple attach, it surfaces ABR quality levels, audio tracks and live
 * state, and performs automatic recovery for transient network/media errors so
 * the player keeps playing through brief interruptions.
 */
export async function createVideoEngine(
  options: VideoEngineOptions
): Promise<VideoEngineHandle> {
  const { video, src, strategy, onError, onStateChange } = options;
  let hls: Hls | null = null;
  let dash: MediaPlayerClass | null = null;
  let state: EngineState = { ...EMPTY_STATE };

  const emit = () => onStateChange?.({ ...state, levels: [...state.levels], audioTracks: [...state.audioTracks] });

  /**
   * Tear down streaming engines. `resetMedia` controls whether the shared
   * <video> element's src is cleared — only the canonical teardown (switchSrc
   * / explicit reset) should do that. During React StrictMode's double-invoke,
   * an abandoned engine must NOT clear the element or it wipes the live
   * engine's freshly-set src (root cause of the "black screen / infinite
   * spinner" the new player exhibited everywhere it was mounted).
   */
  const destroy = (resetMedia = false) => {
    try {
      hls?.destroy();
    } catch {
      /* noop */
    }
    hls = null;
    try {
      dash?.reset();
    } catch {
      /* noop */
    }
    dash = null;
    state = { ...EMPTY_STATE };
    if (resetMedia) {
      video.removeAttribute('src');
      try {
        video.load();
      } catch {
        /* noop */
      }
    }
  };

  // ---- HLS ----------------------------------------------------------------
  const attachHls = async (url: string) => {
    const HlsModule = await import('hls.js');
    const HlsCtor = HlsModule.default;

    if (HlsCtor.isSupported()) {
      hls = new HlsCtor({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        // Be resilient to flaky networks before giving up.
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingMaxRetry: 6,
      });

      hls.loadSource(url);
      hls.attachMedia(video);

      const syncLevels = () => {
        if (!hls) return;
        state.levels = hls.levels.map((lvl, i) => ({
          id: String(i),
          label: qualityLabel(lvl.height, lvl.bitrate),
          height: lvl.height,
          width: lvl.width,
          bitrate: lvl.bitrate,
        }));
        state.isLive = hls.levels.some((lvl) => lvl.details?.live) || false;
        state.autoLevel = hls.autoLevelEnabled ?? true;
        state.activeLevelId = state.autoLevel ? 'auto' : String(hls.currentLevel);
        emit();
      };

      const syncAudio = () => {
        if (!hls) return;
        state.audioTracks = hls.audioTracks.map((tr) => ({
          id: String(tr.id),
          label: tr.name || tr.lang || `Audio ${tr.id}`,
          language: tr.lang,
        }));
        state.activeAudioTrackId =
          hls.audioTrack >= 0 ? String(hls.audioTrack) : state.audioTracks[0]?.id ?? null;
        emit();
      };

      hls.on(HlsCtor.Events.MANIFEST_PARSED, syncLevels);
      hls.on(HlsCtor.Events.LEVELS_UPDATED, syncLevels);
      hls.on(HlsCtor.Events.LEVEL_SWITCHED, (_e, data) => {
        if (!hls) return;
        state.autoLevel = hls.autoLevelEnabled ?? true;
        state.activeLevelId = state.autoLevel ? 'auto' : String(data.level);
        emit();
      });
      hls.on(HlsCtor.Events.AUDIO_TRACKS_UPDATED, syncAudio);
      hls.on(HlsCtor.Events.AUDIO_TRACK_SWITCHED, syncAudio);

      hls.on(HlsCtor.Events.ERROR, (_e, data) => {
        if (!data.fatal || !hls) return;
        switch (data.type) {
          case HlsModule.ErrorTypes.NETWORK_ERROR:
            // Transient: try to resume loading.
            hls.startLoad();
            break;
          case HlsModule.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            onError?.(data.details || data.type);
            break;
        }
      });
      return;
    }

    // Safari / iOS: native HLS.
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      return;
    }
    onError?.('hls-unsupported');
  };

  // ---- DASH ---------------------------------------------------------------
  const attachDash = async (url: string) => {
    const dashjs = await import('dashjs');
    dash = dashjs.MediaPlayer().create();
    dash.initialize(video, url, false);

    const player = dash as unknown as DashLike;
    const bitrateOf = (r: DashRepresentation): number | undefined =>
      r.bitrateInKbit != null ? r.bitrateInKbit * 1000 : r.bandwidth;

    const syncDash = () => {
      try {
        const reps = player.getRepresentationsByType('video') || [];
        state.levels = reps.map((r, i) => ({
          id: String(r.index ?? i),
          label: qualityLabel(r.height, bitrateOf(r)),
          height: r.height,
          width: r.width,
          bitrate: bitrateOf(r),
        }));
        const audio = player.getTracksFor('audio') || [];
        state.audioTracks = audio.map((tr, i) => ({
          id: String(tr.id ?? i),
          label: tr.labels?.[0]?.text || tr.lang || `Audio ${i + 1}`,
          language: tr.lang ?? undefined,
        }));
        state.isLive = typeof player.isDynamic === 'function' ? player.isDynamic() : false;
        state.autoLevel = true;
        state.activeLevelId = 'auto';
        emit();
      } catch {
        /* metadata not ready yet */
      }
    };

    player.on('streamInitialized', syncDash);
    player.on('qualityChangeRendered', () => {
      try {
        const current = player.getCurrentRepresentationForType('video');
        const idx = current?.index;
        state.activeLevelId = state.autoLevel || idx == null ? 'auto' : String(idx);
        emit();
      } catch {
        /* noop */
      }
    });
    player.on('error', (e: unknown) => {
      const err = e as { error?: { message?: string; code?: number } };
      onError?.(err?.error?.message || 'dash-error');
    });
  };

  const attach = async (url: string, strat: PlaybackStrategy) => {
    destroy();
    if (strat === 'unsupported') {
      onError?.('unsupported');
      return;
    }
    if (strat === 'hls') {
      await attachHls(url);
      return;
    }
    if (strat === 'dash') {
      await attachDash(url);
      return;
    }
    try {
      const target = new URL(url, typeof window !== 'undefined' ? window.location.href : url).href;
      const current = video.currentSrc || video.src;
      if (current === target && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        return;
      }
    } catch {
      const current = video.currentSrc || video.src;
      if (current === url && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        return;
      }
    }
    video.src = url;
  };

  await attach(src, strategy);

  return {
    destroy,
    switchSrc: (newSrc, newStrategy) => {
      void attach(newSrc, newStrategy);
    },
    setLevel: (id: string) => {
      const auto = id === 'auto';
      state.autoLevel = auto;
      state.activeLevelId = id;
      if (hls) {
        hls.currentLevel = auto ? -1 : Number(id);
        // For instant manual switch, also pin the next level.
        if (!auto) hls.nextLevel = Number(id);
      } else if (dash) {
        const player = dash as unknown as DashLike;
        try {
          player.updateSettings({
            streaming: { abr: { autoSwitchBitrate: { video: auto } } },
          });
          if (!auto) player.setRepresentationForTypeByIndex('video', Number(id));
        } catch {
          /* noop */
        }
      }
      emit();
    },
    setAudioTrack: (id: string) => {
      state.activeAudioTrackId = id;
      if (hls) {
        hls.audioTrack = Number(id);
      } else if (dash) {
        const player = dash as unknown as DashLike;
        try {
          const tracks = player.getTracksFor('audio') || [];
          const match = tracks.find((tr, i) => String(tr.id ?? i) === id);
          if (match) player.setCurrentTrack(match);
        } catch {
          /* noop */
        }
      }
      emit();
    },
    getState: () => ({ ...state, levels: [...state.levels], audioTracks: [...state.audioTracks] }),
  };
}

export type { VideoQualityLevel, VideoAudioTrack };
