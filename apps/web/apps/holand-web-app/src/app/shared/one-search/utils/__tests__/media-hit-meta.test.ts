import { describe, expect, it } from 'vitest';
import type { OneSearchHit } from '@/types/one-search.types';
import {
  dedupeHitsByArtifactId,
  hitDurationSec,
  hitMatchKind,
  hitMediaMeta,
} from '@/app/shared/one-search/utils/media-hit-meta';

function hit(id: string, artifactId?: string, extra?: Record<string, unknown>): OneSearchHit {
  return {
    id,
    title: `hit-${id}`,
    meta: { artifact_id: artifactId, ...extra },
  };
}

describe('media-hit-meta', () => {
  it('parses transcript_match and match kind', () => {
    const h = hit('1', 'art-1', {
      match: 'transcript',
      has_transcript: true,
      duration: 120.5,
      transcript_match: { start_sec: 1, end_sec: 2, text: 'hello' },
    });
    const meta = hitMediaMeta(h);
    expect(meta.match).toBe('transcript');
    expect(meta.transcript_match?.start_sec).toBe(1);
    expect(hitDurationSec(h)).toBe(120.5);
    expect(hitMatchKind(h)).toBe('transcript');
  });

  it('dedupes by artifact_id keeping first occurrence', () => {
    const hits = [
      hit('a', 'same-art'),
      hit('b', 'same-art'),
      hit('c', 'other'),
    ];
    const out = dedupeHitsByArtifactId(hits);
    expect(out).toHaveLength(2);
    expect(out[0].id).toBe('a');
    expect(out[1].id).toBe('c');
  });
});
