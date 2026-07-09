import { describe, expect, it } from 'vitest';
import { parseSmartSearchResponse } from '../smart-search-parse';
import { unwrapToolExecuteData } from '@/utils/tool-execute';

const SMART_SEARCH_FIXTURE = {
  ok: true,
  tool_id: 'plugin_smart_search',
  result: {
    ok: true,
    data: {
      query: 'test',
      mode: 'all',
      tookMs: 82,
      total: 13,
      lanes: [
        {
          lane: 'chat',
          total: 1,
          hits: [
            {
              id: 'msg-1',
              title: 'Re: test',
              snippet: 'hello test',
              href: '/messages?search=test',
              meta: { lane: 'chat', source: 'plugin.smart_search' },
            },
          ],
        },
        {
          lane: 'cases',
          total: 0,
          hits: [],
        },
        {
          lane: 'files',
          total: 3,
          hits: [
            { id: 'fm-1', title: 'secure_test.txt', meta: { lane: 'files' } },
            { id: 'fm-2', title: 'report.xlsx', meta: { lane: 'files' } },
            { id: 'fm-3', title: 'notes.md', meta: { lane: 'files' } },
          ],
        },
        {
          lane: 'storage',
          total: 3,
          hits: [{ id: 'fm-img', title: 'test.jpg', meta: { lane: 'storage', mime: 'image/jpeg' } }],
        },
        {
          lane: 'graph',
          total: 3,
          hits: [{ id: 'graph-1', title: 'Entity', href: '/graph-explorer' }],
        },
        {
          lane: 'users',
          total: 3,
          hits: [{ id: 'user-1', title: 'worktest2', snippet: 'worktest2@t.com' }],
        },
      ],
      metadata: {
        byLane: {
          chat: 1,
          cases: 0,
          files: 3,
          storage: 3,
          graph: 3,
          users: 3,
        },
        notes: {
          plugin_smart_search_text: 'embed_tool_failed:binding_not_configured',
          plugin_smart_search_image_clip: 'binding_not_configured:404',
        },
      },
    },
  },
};

describe('unwrapToolExecuteData', () => {
  it('unwraps result.data from gateway envelope', () => {
    const data = unwrapToolExecuteData<{ query: string }>(SMART_SEARCH_FIXTURE);
    expect(data?.query).toBe('test');
  });

  it('returns null for invalid input', () => {
    expect(unwrapToolExecuteData(null)).toBeNull();
    expect(unwrapToolExecuteData({ ok: true })).toBeNull();
  });
});

describe('parseSmartSearchResponse', () => {
  const request = { query: 'test', mode: 'all' as const };

  it('parses full gateway envelope with lanes and facets', () => {
    const parsed = parseSmartSearchResponse(SMART_SEARCH_FIXTURE, request);
    expect(parsed).not.toBeNull();
    expect(parsed!.response.query).toBe('test');
    expect(parsed!.response.total).toBe(7);
    expect(parsed!.response.lanes).toHaveLength(6);
    expect(parsed!.response.facets?.byLane?.chat).toBe(1);
    expect(parsed!.response.facets?.byLane?.cases).toBe(0);
    expect(parsed!.degradedSources?.plugin_smart_search_text).toContain('binding');
  });

  it('accepts already-unwrapped data payload', () => {
    const inner = SMART_SEARCH_FIXTURE.result.data;
    const parsed = parseSmartSearchResponse(inner, request);
    expect(parsed?.response.lanes.length).toBe(6);
  });

  it('returns empty lanes response when lanes array is empty', () => {
    const parsed = parseSmartSearchResponse(
      { ok: true, result: { data: { total: 0, lanes: [] } } },
      request
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.response.total).toBe(0);
    expect(parsed!.response.lanes).toHaveLength(6);
  });

  it('parses search_kind from payload', () => {
    const fixture = {
      result: {
        data: {
          search_kind: 'visual',
          lanes: [{ lane: 'storage', total: 1, hits: [{ id: '1', title: 'img' }] }],
        },
      },
    };
    const parsed = parseSmartSearchResponse(fixture, { query: '', mode: 'image' });
    expect(parsed?.searchKind).toBe('visual');
  });

  it('returns empty lanes when lanes array is missing', () => {
    const parsed = parseSmartSearchResponse(
      { ok: true, result: { data: { total: 0 } } },
      request
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.response.total).toBe(0);
    expect(parsed!.response.lanes).toHaveLength(6);
  });

  it('returns empty lanes when all lane rows are invalid', () => {
    const parsed = parseSmartSearchResponse(
      { result: { data: { lanes: [{ lane: 'invalid', hits: [] }] } } },
      request
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.response.total).toBe(0);
  });

  it('computes facets from lane totals when metadata.byLane absent', () => {
    const fixture = {
      result: {
        data: {
          lanes: [
            { lane: 'chat', total: 2, hits: [{ id: '1', title: 'a' }, { id: '2', title: 'b' }] },
            { lane: 'files', total: 1, hits: [{ id: '3', title: 'c' }] },
          ],
          total: 3,
        },
      },
    };
    const parsed = parseSmartSearchResponse(fixture, request);
    expect(parsed?.response.facets?.byLane?.chat).toBe(2);
    expect(parsed?.response.facets?.byLane?.files).toBe(1);
  });

  it('parses visual search with channels.llm, query_image echo, and degraded notes', () => {
    const visualFixture = {
      ok: true,
      tool_id: 'plugin_smart_search',
      result: {
        ok: true,
        data: {
          query: '',
          mode: 'image',
          search_kind: 'visual',
          tookMs: 1830,
          total: 15,
          lanes: [
            {
              lane: 'storage',
              total: 15,
              hits: [
                {
                  id: 'fm-74560043-b6e1-4c4d-bf3b-76c0e528cfec',
                  title: 'Screenshot (19).png',
                  score: 0.016393,
                  meta: { match: 'metadata', artifact_id: '74560043-b6e1-4c4d-bf3b-76c0e528cfec' },
                },
              ],
            },
          ],
          metadata: {
            notes: {
              plugin_smart_search_image_by_example: 'no_visual_matches',
            },
            query_image: {
              artifact_id: 'f3ddc445-b71b-4c19-be5b-707428e677ac',
            },
          },
        },
        channels: {
          llm: "Unified search '(visual)' (mode=image, kind=visual) -> 15 hits across 1 lanes in 1830ms.\nLanes: storage=15\nDegraded sources: plugin_smart_search_image_by_example:no_visual_matches",
        },
        timings_ms: { total: 1830 },
      },
    };

    const parsed = parseSmartSearchResponse(visualFixture, { query: '', mode: 'image' });
    expect(parsed?.searchKind).toBe('visual');
    expect(parsed?.queryImageEcho).toBe('f3ddc445-b71b-4c19-be5b-707428e677ac');
    expect(parsed?.aiSummary).toContain('15 hits across 1 lanes');
    expect(parsed?.degradedSources?.plugin_smart_search_image_by_example).toBe('no_visual_matches');
    expect(parsed?.response.lanes[0]?.hits[0]?.score).toBe(0.016393);
    expect(parsed?.response.lanes[0]?.hits[0]?.meta?.match).toBe('metadata');
  });
});
