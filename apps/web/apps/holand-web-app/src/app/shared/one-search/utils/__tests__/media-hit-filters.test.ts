import { describe, expect, it } from 'vitest';
import type { OneSearchHit } from '@/types/one-search.types';
import {
  collectAudioMimeTypes,
  collectVideoMimeTypes,
  filterMediaHits,
  sortMediaHits,
  DEFAULT_MEDIA_FILTERS,
} from '@/app/shared/one-search/utils/image-hit-filters';

const audioHit = (id: string, mime: string, duration?: number): OneSearchHit => ({
  id,
  title: id,
  meta: { mime, duration, has_transcript: id.includes('tx') },
});

describe('media-hit-filters', () => {
  it('collects audio and video mime prefixes', () => {
    const hits = [
      audioHit('1', 'audio/wav'),
      audioHit('2', 'audio/mpeg'),
      audioHit('3', 'video/mp4'),
    ];
    expect(collectAudioMimeTypes(hits)).toEqual(['audio/mpeg', 'audio/wav']);
    expect(collectVideoMimeTypes(hits)).toEqual(['video/mp4']);
  });

  it('filters by duration and transcript flag', () => {
    const hits = [
      audioHit('short', 'audio/wav', 10),
      audioHit('long-tx', 'audio/wav', 400),
      audioHit('long', 'audio/mpeg', 500),
    ];
    const filtered = filterMediaHits(hits, {
      ...DEFAULT_MEDIA_FILTERS,
      minDurationSec: 60,
      hasTranscriptOnly: true,
    });
    expect(filtered.map((h) => h.id)).toEqual(['long-tx']);
  });

  it('sorts by duration descending', () => {
    const hits = [
      audioHit('a', 'audio/wav', 100),
      audioHit('b', 'audio/wav', 300),
    ];
    const sorted = sortMediaHits(hits, 'duration_desc');
    expect(sorted.map((h) => h.id)).toEqual(['b', 'a']);
  });
});
