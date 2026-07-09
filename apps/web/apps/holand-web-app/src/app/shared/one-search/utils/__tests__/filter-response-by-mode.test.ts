import { describe, expect, it } from 'vitest';
import type { OneSearchHit, OneSearchResponse } from '@/types/one-search.types';
import { filterResponseByMode } from '../filter-response-by-mode';

function baseResponse(hitsByLane: Record<string, OneSearchHit[]>): OneSearchResponse {
  return {
    query: 'test',
    mode: 'all',
    total: 0,
    tookMs: 1,
    lanes: (['chat', 'cases', 'files', 'storage', 'users', 'graph', 'projects_tasks'] as const).map((lane) => ({
      lane,
      hits: hitsByLane[lane] ?? [],
      total: hitsByLane[lane]?.length ?? 0,
    })),
  };
}

describe('filterResponseByMode', () => {
  it('keeps image hits when mime is empty but media_type is image', () => {
    const imageHit: OneSearchHit = {
      id: 'img-1',
      title: 'test.jpg',
      meta: { media_type: 'image', mime: '' },
    };
    const response = baseResponse({ storage: [imageHit] });
    const filtered = filterResponseByMode(response, 'image');
    expect(filtered.lanes.find((l) => l.lane === 'storage')?.hits).toHaveLength(1);
  });

  it('keeps audio hits from media_type without mime', () => {
    const audioHit: OneSearchHit = {
      id: 'aud-1',
      title: 'clip.mp3',
      meta: { media_type: 'audio' },
    };
    const response = baseResponse({ storage: [audioHit] });
    const filtered = filterResponseByMode(response, 'audio');
    expect(filtered.lanes.find((l) => l.lane === 'storage')?.hits).toHaveLength(1);
  });

  it('excludes pure image hits in text mode', () => {
    const imageHit: OneSearchHit = {
      id: 'img-1',
      title: 'photo.png',
      meta: { media_type: 'image' },
    };
    const chatHit: OneSearchHit = {
      id: 'chat-1',
      title: 'discussion about report',
    };
    const response = baseResponse({ storage: [imageHit], chat: [chatHit] });
    const filtered = filterResponseByMode(response, 'text');
    expect(filtered.lanes.find((l) => l.lane === 'storage')?.hits).toHaveLength(0);
    expect(filtered.lanes.find((l) => l.lane === 'chat')?.hits).toHaveLength(1);
  });

  it('keeps storage filename matches in file mode', () => {
    const screenshot: OneSearchHit = {
      id: 'img-1',
      title: 'my-screen-capture.png',
      meta: { media_type: 'image' },
    };
    const response = {
      ...baseResponse({ storage: [screenshot] }),
      query: 'screen',
    };
    const filtered = filterResponseByMode(response, 'file');
    expect(filtered.lanes.find((l) => l.lane === 'storage')?.hits).toHaveLength(1);
  });
});
