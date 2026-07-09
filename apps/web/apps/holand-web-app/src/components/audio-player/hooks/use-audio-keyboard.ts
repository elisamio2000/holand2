import { useCallback, useEffect } from 'react';
import type { UseAudioPlaybackReturn } from '../types';

export function useAudioKeyboard(
  playback: Pick<
    UseAudioPlaybackReturn,
    | 'togglePlay'
    | 'skipBack'
    | 'skipForward'
    | 'handleVolumeChange'
    | 'toggleMute'
    | 'volume'
    | 'activeRegion'
    | 'removeActiveRegion'
    | 'toggleLoop'
    | 'getActiveAudio'
    | 'wsRef'
    | 'isFocused'
    | 'isWaveSurferActive'
  >,
  enabled = true
) {
  const {
    togglePlay,
    skipBack,
    skipForward,
    handleVolumeChange,
    toggleMute,
    volume,
    activeRegion,
    removeActiveRegion,
    toggleLoop,
    getActiveAudio,
    wsRef,
    isFocused,
    isWaveSurferActive,
  } = playback;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled || !isFocused) return;
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const ws = wsRef.current;
      const audio = getActiveAudio();
      const wsActive = isWaveSurferActive();
      if (!ws && !audio && !wsActive) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'j':
        case 'arrowleft':
          e.preventDefault();
          skipBack();
          break;
        case 'l':
        case 'arrowright':
          e.preventDefault();
          skipForward();
          break;
        case 'arrowup':
          e.preventDefault();
          handleVolumeChange({
            target: { value: String(Math.min(1, volume + 0.05)) },
          } as React.ChangeEvent<HTMLInputElement>);
          break;
        case 'arrowdown':
          e.preventDefault();
          handleVolumeChange({
            target: { value: String(Math.max(0, volume - 0.05)) },
          } as React.ChangeEvent<HTMLInputElement>);
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'r':
          e.preventDefault();
          toggleLoop();
          break;
        case 'delete':
        case 'backspace':
          if (activeRegion && ws) {
            e.preventDefault();
            removeActiveRegion();
          }
          break;
        default:
          break;
      }
    },
    [
      enabled,
      isFocused,
      togglePlay,
      skipBack,
      skipForward,
      handleVolumeChange,
      toggleMute,
      volume,
      activeRegion,
      removeActiveRegion,
      toggleLoop,
      getActiveAudio,
      wsRef,
      isWaveSurferActive,
    ]
  );

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown, enabled]);
}
