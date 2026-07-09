'use client';

import { useCallback, useMemo, useState } from 'react';
import type { FilmstripSpriteMeta } from '../timeline/filmstrip-timeline';

interface UseScrubPreviewOptions {
  duration: number;
  spriteMeta?: FilmstripSpriteMeta | null;
  intervalSec?: number;
}

/**
 * Resolve hover scrub thumbnail from BE sprite sheet (Vidstack/Mux pattern).
 */
export function useScrubPreview({
  duration,
  spriteMeta,
  intervalSec = 10,
}: UseScrubPreviewOptions) {
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  const previewStyle = useMemo(() => {
    if (hoverTime == null || !spriteMeta || duration <= 0) return null;
    const index = Math.min(
      spriteMeta.tileCount - 1,
      Math.max(0, Math.floor(hoverTime / spriteMeta.intervalSec))
    );
    return {
      width: spriteMeta.tileWidth,
      height: spriteMeta.tileHeight,
      backgroundImage: `url(${spriteMeta.spriteUrl})`,
      backgroundPosition: `-${index * spriteMeta.tileWidth}px 0`,
      backgroundSize: `${spriteMeta.tileWidth * spriteMeta.tileCount}px ${spriteMeta.tileHeight}px`,
    } as const;
  }, [duration, hoverTime, spriteMeta]);

  const onHoverRatio = useCallback(
    (ratio: number | null) => {
      if (ratio == null || duration <= 0) {
        setHoverTime(null);
        return;
      }
      setHoverTime(ratio * duration);
    },
    [duration]
  );

  return {
    hoverTime,
    previewStyle,
    onHoverRatio,
    intervalSec,
  };
}
