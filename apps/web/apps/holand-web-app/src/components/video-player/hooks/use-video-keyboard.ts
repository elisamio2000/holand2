import { useCallback, useEffect } from 'react';
import { PLAYBACK_SPEEDS } from '../constants';
import type { UseVideoPlaybackReturn } from '../types';

const SKIP_SEC = 10;
const FINE_SEEK_SEC = 5;

export function useVideoKeyboard(
  playback: Pick<
    UseVideoPlaybackReturn,
    | 'togglePlay'
    | 'seekTo'
    | 'currentTime'
    | 'duration'
    | 'setVolume'
    | 'volume'
    | 'setMuted'
    | 'isMuted'
    | 'setPlaybackRate'
    | 'playbackRate'
    | 'setLoop'
    | 'loop'
    | 'setActiveSubtitle'
    | 'activeSubtitleId'
    | 'loadedSubtitles'
    | 'takeScreenshot'
    | 'requestFullscreen'
    | 'requestPiP'
    | 'isFocused'
    | 'mirrorPlayback'
  >,
  enabled = true
) {
  const {
    togglePlay,
    seekTo,
    currentTime,
    duration,
    setVolume,
    volume,
    setMuted,
    isMuted,
    setPlaybackRate,
    playbackRate,
    setLoop,
    loop,
    setActiveSubtitle,
    activeSubtitleId,
    loadedSubtitles,
    takeScreenshot,
    requestFullscreen,
    requestPiP,
    isFocused,
    mirrorPlayback,
  } = playback;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !isFocused || mirrorPlayback) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
          e.preventDefault();
          seekTo(Math.max(0, currentTime - SKIP_SEC));
          break;
        case 'l':
          e.preventDefault();
          seekTo(Math.min(duration, currentTime + SKIP_SEC));
          break;
        case 'arrowleft':
          e.preventDefault();
          seekTo(Math.max(0, currentTime - (e.shiftKey ? FINE_SEEK_SEC : SKIP_SEC)));
          break;
        case 'arrowright':
          e.preventDefault();
          seekTo(Math.min(duration, currentTime + (e.shiftKey ? FINE_SEEK_SEC : SKIP_SEC)));
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          if (isMuted) setMuted(false);
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;
        case 'm':
          e.preventDefault();
          setMuted(!isMuted);
          break;
        case 'r':
          e.preventDefault();
          setLoop(!loop);
          break;
        case 'f':
          e.preventDefault();
          requestFullscreen();
          break;
        case 'p':
          e.preventDefault();
          void requestPiP();
          break;
        case 'c':
          e.preventDefault();
          void takeScreenshot();
          break;
        case 'v':
          if (loadedSubtitles.length > 0) {
            e.preventDefault();
            if (activeSubtitleId) {
              setActiveSubtitle(null);
            } else {
              setActiveSubtitle(loadedSubtitles[0]?.id ?? null);
            }
          }
          break;
        case 'home':
          e.preventDefault();
          seekTo(0);
          break;
        case 'end':
          e.preventDefault();
          if (duration > 0) seekTo(duration);
          break;
        case '<':
        case ',':
          if (e.shiftKey) {
            e.preventDefault();
            const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as (typeof PLAYBACK_SPEEDS)[number]);
            if (idx > 0) setPlaybackRate(PLAYBACK_SPEEDS[idx - 1]);
          }
          break;
        case '>':
        case '.':
          if (e.shiftKey) {
            e.preventDefault();
            const idx = PLAYBACK_SPEEDS.indexOf(playbackRate as (typeof PLAYBACK_SPEEDS)[number]);
            if (idx < PLAYBACK_SPEEDS.length - 1) setPlaybackRate(PLAYBACK_SPEEDS[idx + 1]);
          }
          break;
        default:
          break;
      }
    },
    [
      enabled,
      isFocused,
      mirrorPlayback,
      togglePlay,
      seekTo,
      currentTime,
      duration,
      setVolume,
      volume,
      setMuted,
      isMuted,
      setLoop,
      loop,
      setActiveSubtitle,
      activeSubtitleId,
      loadedSubtitles,
      takeScreenshot,
      requestFullscreen,
      requestPiP,
      setPlaybackRate,
      playbackRate,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
