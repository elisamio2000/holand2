import { describe, expect, it } from 'vitest';
import { buildSmartSearchArgs, mapQueryImageToApi } from '../build-smart-search-args';

describe('buildSmartSearchArgs', () => {
  it('returns null when neither query nor queryImage is set', () => {
    expect(buildSmartSearchArgs({ query: '  ' })).toBeNull();
    expect(buildSmartSearchArgs({ query: '' })).toBeNull();
  });

  it('forwards UI mode and text query', () => {
    const args = buildSmartSearchArgs({ query: 'screen', mode: 'file' });
    expect(args).toEqual({
      mode: 'file',
      top_k: 15,
      query: 'screen',
    });
  });

  it('includes query_image and omits empty query for visual-only search', () => {
    const args = buildSmartSearchArgs({
      query: '',
      mode: 'image',
      queryImage: {
        artifact_id: 'ea863001-4869-43e1-baff-31c902ddb12b',
        path: 'minio://uploads/test.png',
        crop: { x: 5, y: 10, width: 40, height: 35 },
      },
    });
    expect(args).toEqual({
      mode: 'image',
      top_k: 15,
      query_image: {
        artifact_id: 'ea863001-4869-43e1-baff-31c902ddb12b',
        path: 'minio://uploads/test.png',
        crop: { x: 5, y: 10, width: 40, height: 35 },
      },
    });
  });

  it('maps score_threshold when scoreThreshold is set', () => {
    const args = buildSmartSearchArgs({
      query: 'test',
      mode: 'all',
      scoreThreshold: 0.42,
    });
    expect(args?.score_threshold).toBe(0.42);
  });

  it('forwards filters and sort to smart_search args', () => {
    const args = buildSmartSearchArgs({
      query: 'report',
      mode: 'all',
      sort: 'date_desc',
      filters: {
        lanes: ['files'],
        fileTypes: ['pdf'],
        dateFrom: '2025-01-01',
      },
    });
    expect(args?.sort).toBe('date_desc');
    expect(args?.filters).toEqual({
      lanes: ['files'],
      file_types: ['pdf'],
      date_from: '2025-01-01',
    });
  });

  it('supports hybrid text + image', () => {
    const args = buildSmartSearchArgs({
      query: 'red car',
      mode: 'image',
      queryImage: { artifact_id: 'uuid-1' },
    });
    expect(args?.query).toBe('red car');
    expect(args?.query_image).toEqual({ artifact_id: 'uuid-1' });
  });

  it('forwards user_id when userId is set', () => {
    const args = buildSmartSearchArgs({ query: 'cases', mode: 'all', userId: 'user-42' });
    expect(args?.user_id).toBe('user-42');
  });

  it('trims user_id whitespace', () => {
    const args = buildSmartSearchArgs({ query: 'cases', mode: 'all', userId: '  user-42  ' });
    expect(args?.user_id).toBe('user-42');
  });
});

describe('mapQueryImageToApi', () => {
  it('maps optional path and crop', () => {
    expect(
      mapQueryImageToApi({
        artifact_id: 'a',
        path: 'minio://x',
        crop: { x: 1, y: 2, width: 3, height: 4 },
      })
    ).toEqual({
      artifact_id: 'a',
      path: 'minio://x',
      crop: { x: 1, y: 2, width: 3, height: 4 },
    });
  });
});
