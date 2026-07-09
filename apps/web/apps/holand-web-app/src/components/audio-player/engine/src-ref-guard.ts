/** Guards WaveSurfer re-init when src unchanged and an instance is already mounted. */
export function shouldSkipWaveSurferReinit(
  trackedSrc: string,
  nextSrc: string,
  hasInstance: boolean
): boolean {
  return Boolean(nextSrc) && trackedSrc === nextSrc && hasInstance;
}

/** Main and inline WaveSurfer paths use independent src trackers. */
export interface SrcRefPair {
  mainSrcRef: string;
  inlineSrcRef: string;
}

export function pickSrcTracker(
  pair: SrcRefPair,
  surface: 'main' | 'inline'
): { get: () => string; set: (src: string) => string } {
  if (surface === 'main') {
    return {
      get: () => pair.mainSrcRef,
      set: (src) => {
        pair.mainSrcRef = src;
        return pair.mainSrcRef;
      },
    };
  }
  return {
    get: () => pair.inlineSrcRef,
    set: (src) => {
      pair.inlineSrcRef = src;
      return pair.inlineSrcRef;
    },
  };
}
