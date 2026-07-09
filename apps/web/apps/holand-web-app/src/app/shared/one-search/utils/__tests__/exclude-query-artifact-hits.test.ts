import { describe, expect, it } from 'vitest';
import type { OneSearchHit, OneSearchResponse } from '@/types/one-search.types';
import {
  excludeQueryArtifactFromResponse,
  isQueryArtifactHit,
} from '../exclude-query-artifact-hits';

describe('isQueryArtifactHit', () => {
  const selfHit: OneSearchHit = {
    id: 'fm-1',
    title: 'query.png',
    score: 0.99,
    meta: { artifact_id: 'uuid-query', match: 'visual' },
  };

  it('matches by meta.artifact_id', () => {
    expect(
      isQueryArtifactHit(selfHit, { artifact_id: 'uuid-query' }, undefined)
    ).toBe(true);
  });

  it('matches by queryImageEcho from backend metadata', () => {
    expect(isQueryArtifactHit(selfHit, null, 'uuid-query')).toBe(true);
  });

  it('matches by hit.id when it equals artifact uuid', () => {
    expect(
      isQueryArtifactHit(
        { id: 'uuid-query', title: 'x.png', meta: {} },
        { artifact_id: 'uuid-query' }
      )
    ).toBe(true);
  });

  it('matches by storage path when artifact ids differ in shape', () => {
    expect(
      isQueryArtifactHit(
        {
          id: 'fm-9',
          title: 'x.png',
          meta: { artifact_id: 'other', storage_path: 'minio://bucket/x.png' },
        },
        {
          artifact_id: 'uuid-query',
          path: 'minio://bucket/x.png',
        }
      )
    ).toBe(true);
  });

  it('does not match unrelated hits', () => {
    expect(
      isQueryArtifactHit(
        { id: 'fm-2', title: 'other.png', meta: { artifact_id: 'uuid-other' } },
        { artifact_id: 'uuid-query' }
      )
    ).toBe(false);
  });
});

describe('excludeQueryArtifactFromResponse', () => {
  it('removes query artifact from all lanes and updates totals', () => {
    const self: OneSearchHit = {
      id: 'a1',
      title: 'self.png',
      meta: { artifact_id: 'query-id' },
    };
    const other: OneSearchHit = {
      id: 'a2',
      title: 'other.png',
      meta: { artifact_id: 'other-id' },
    };
    const response: OneSearchResponse = {
      query: '',
      mode: 'image',
      total: 2,
      lanes: [
        { lane: 'storage', hits: [self, other], total: 2 },
        { lane: 'files', hits: [self], total: 1 },
      ],
      facets: {
        byLane: {
          storage: 2,
          files: 1,
          chat: 0,
          cases: 0,
          users: 0,
          graph: 0,
          projects_tasks: 0,
        },
      },
    };

    const filtered = excludeQueryArtifactFromResponse(response, {
      artifact_id: 'query-id',
    });

    expect(filtered.total).toBe(1);
    expect(filtered.lanes.find((l) => l.lane === 'storage')?.hits).toEqual([other]);
    expect(filtered.lanes.find((l) => l.lane === 'files')?.hits).toEqual([]);
    expect(filtered.facets?.byLane?.storage).toBe(1);
    expect(filtered.facets?.byLane?.files).toBe(0);
  });

  it('no-ops when no query image is set', () => {
    const response: OneSearchResponse = {
      query: 'x',
      mode: 'text',
      lanes: [{ lane: 'chat', hits: [{ id: '1', title: 'a' }], total: 1 }],
    };
    expect(excludeQueryArtifactFromResponse(response)).toBe(response);
  });
});
