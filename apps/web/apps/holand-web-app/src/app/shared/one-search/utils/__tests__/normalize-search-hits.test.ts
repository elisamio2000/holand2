import { describe, expect, it, vi } from 'vitest';
import type { OneSearchHit } from '@/types/one-search.types';
import {
  buildFileExplorerArtifactHref,
  buildMessagesChatHref,
  inferHitMediaType,
  inferHitMime,
  normalizeSearchHit,
  normalizeSearchResponse,
} from '../normalize-search-hits';

vi.mock('@/services/storage.service', () => ({
  storageService: {
    getDownloadUrl: (id: string) => `/storage/artifacts/${id}/download`,
    getThumbnailUrl: (id: string) => `/storage/artifacts/${id}/thumb`,
  },
}));

vi.mock('@/utils/storage-media-url', () => ({
  supportsStorageThumbnailEndpoint: () => true,
}));

describe('inferHitMime', () => {
  it('uses media_type when mime is empty', () => {
    const hit: OneSearchHit = {
      id: '1',
      title: 'test.jpg',
      meta: { media_type: 'image', mime: '' },
    };
    expect(inferHitMime(hit)).toBe('image/jpeg');
  });

  it('falls back to file extension', () => {
    const hit: OneSearchHit = {
      id: '2',
      title: 'voice-note.mp3',
      meta: {},
    };
    expect(inferHitMime(hit)).toBe('audio/mpeg');
  });
});

describe('inferHitMediaType', () => {
  it('detects image from media_type without mime', () => {
    const hit: OneSearchHit = {
      id: '1',
      title: 'photo',
      meta: { media_type: 'image' },
    };
    expect(inferHitMediaType(hit)).toBe('image');
  });
});

describe('buildMessagesChatHref', () => {
  it('builds people chat deep link from meta.from', () => {
    const href = buildMessagesChatHref({ from: 'partner-uuid-123' });
    expect(href).toBe('/messages?view=people&partner=partner-uuid-123');
  });

  it('falls back to mailbox search when partner missing', () => {
    const href = buildMessagesChatHref({}, 'hello');
    expect(href).toBe('/messages?search=hello');
  });
});

describe('buildFileExplorerArtifactHref', () => {
  it('includes search and artifact params', () => {
    const href = buildFileExplorerArtifactHref('art-1', 'test.jpg');
    expect(href).toContain('artifact=art-1');
    expect(href).toContain('search=test.jpg');
  });
});

describe('normalizeSearchHit', () => {
  it('enriches artifact hits with download url and explorer href', () => {
    const hit: OneSearchHit = {
      id: 'fm-1',
      title: 'report.pdf',
      meta: { lane: 'files', artifact_id: 'abc-123', mime: 'application/pdf' },
    };
    const normalized = normalizeSearchHit(hit, 'report', 'files');
    expect(normalized.meta?.url).toContain('abc-123');
    expect(normalized.href).toContain('artifact=abc-123');
  });

  it('normalizes chat hits to people partner link', () => {
    const hit: OneSearchHit = {
      id: 'msg-1',
      title: 'Re: test',
      href: '/messages?search=test',
      meta: { lane: 'chat', from: 'user-99' },
    };
    const normalized = normalizeSearchHit(hit, 'test', 'chat');
    expect(normalized.href).toBe('/messages?view=people&partner=user-99');
  });
});

describe('normalizeSearchResponse', () => {
  it('maps all lane hits', () => {
    const response = normalizeSearchResponse(
      {
        query: 'q',
        mode: 'all',
        total: 1,
        tookMs: 1,
        lanes: [
          {
            lane: 'chat',
            hits: [
              {
                id: 'c1',
                title: 'Hi',
                meta: { lane: 'chat', partner_id: 'p1' },
              },
            ],
          },
        ],
      },
      'q'
    );
    expect(response.lanes[0].hits[0].href).toContain('partner=p1');
  });
});
