'use client';

import { useEffect, useRef, useState } from 'react';
import cn from '@core/utils/class-names';

export interface FilmstripSpriteMeta {
  spriteUrl: string;
  tileWidth: number;
  tileHeight: number;
  intervalSec: number;
  tileCount: number;
}

interface FilmstripTimelineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  duration: number;
  currentTime: number;
  onSeek: (time: number) => void;
  intervalSec?: number;
  className?: string;
  /** BE sprite sheet — when set, canvas sampling is skipped */
  spriteMeta?: FilmstripSpriteMeta | null;
}

export function FilmstripTimeline({
  videoRef,
  duration,
  currentTime,
  onSeek,
  intervalSec = 10,
  className,
  spriteMeta,
}: FilmstripTimelineProps) {
  const [thumbs, setThumbs] = useState<Array<{ time: number; url: string; spriteIndex?: number }>>(
    []
  );
  const cacheRef = useRef<Map<number, string>>(new Map());

  useEffect(() => {
    if (spriteMeta?.spriteUrl && duration > 0) {
      const count = spriteMeta.tileCount;
      const items = Array.from({ length: count }, (_, i) => ({
        time: i * spriteMeta.intervalSec,
        url: spriteMeta.spriteUrl,
        spriteIndex: i,
      }));
      setThumbs(items);
      return;
    }

    const video = videoRef.current;
    if (!video || !duration || duration <= 0 || !video.src) return;

    let cancelled = false;
    const count = Math.min(12, Math.ceil(duration / intervalSec));

    const capture = async () => {
      const sampler = document.createElement('video');
      sampler.src = video.src;
      sampler.muted = true;
      sampler.playsInline = true;
      sampler.crossOrigin = video.crossOrigin || '';

      const results: Array<{ time: number; url: string }> = [];

      for (let i = 0; i < count; i++) {
        if (cancelled) break;
        const time = (i / count) * duration;
        const cached = cacheRef.current.get(time);
        if (cached) {
          results.push({ time, url: cached });
          continue;
        }
        try {
          await new Promise<void>((resolve, reject) => {
            sampler.onloadedmetadata = () => resolve();
            sampler.onerror = () => reject(new Error('sampler_load'));
          });
          sampler.currentTime = time;
          await new Promise<void>((resolve) => {
            sampler.onseeked = () => resolve();
          });
          const canvas = document.createElement('canvas');
          canvas.width = 80;
          canvas.height = 45;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(sampler, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/jpeg', 0.6);
            cacheRef.current.set(time, url);
            results.push({ time, url });
          }
        } catch {
          /* skip frame */
        }
      }

      sampler.removeAttribute('src');
      sampler.load();

      if (!cancelled) setThumbs(results);
    };

    const t = setTimeout(() => void capture(), 800);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [videoRef, duration, intervalSec, spriteMeta]);

  if (!duration) return null;

  return (
    <div className={cn('flex gap-1 overflow-x-auto px-2 py-1', className)}>
      {thumbs.map(({ time, url, spriteIndex }) => (
        <button
          key={time}
          type="button"
          onClick={() => onSeek(time)}
          className={cn(
            'relative shrink-0 overflow-hidden rounded border-2 transition-colors',
            Math.abs(currentTime - time) < intervalSec
              ? 'border-primary'
              : 'border-transparent'
          )}
        >
          {spriteMeta && spriteIndex != null ? (
            <span
              className="block h-11 w-20 bg-gray-200"
              style={{
                backgroundImage: `url(${url})`,
                backgroundPosition: `-${spriteIndex * spriteMeta.tileWidth}px 0`,
                backgroundSize: `${spriteMeta.tileWidth * spriteMeta.tileCount}px ${spriteMeta.tileHeight}px`,
                width: spriteMeta.tileWidth,
                height: spriteMeta.tileHeight,
              }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={url} alt="" className="h-11 w-20 object-cover" />
          )}
        </button>
      ))}
    </div>
  );
}
