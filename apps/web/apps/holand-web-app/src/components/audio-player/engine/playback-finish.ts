/** Pure finish-handler logic shared by WaveSurfer and HTML audio paths. */
export type PlaybackFinishAction = 'restart' | 'stop';

export function resolvePlaybackFinishAction(isLooping: boolean): PlaybackFinishAction {
  return isLooping ? 'restart' : 'stop';
}

export interface PlaybackFinishHandlers {
  restart: () => void;
  stop: () => void;
}

/** Invokes restart or stop based on the live looping flag (via ref at call time). */
export function handlePlaybackFinish(
  isLooping: boolean,
  handlers: PlaybackFinishHandlers
): void {
  if (resolvePlaybackFinishAction(isLooping) === 'restart') {
    handlers.restart();
  } else {
    handlers.stop();
  }
}
