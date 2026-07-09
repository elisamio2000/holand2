import { describe, expect, it } from 'vitest';
import {
  buildOneSearchLiveApiManifest,
  liveApisForMode,
  mapOneSearchRequirementStatus,
  ONE_SEARCH_API_GROUP_ORDER,
} from '../one-search-dev-api-manifest';
import { ONE_SEARCH_API_REQUIREMENTS } from '../search-api-requirements';

describe('one-search-dev-api-manifest', () => {
  it('has unique manifest ids', () => {
    const ids = buildOneSearchLiveApiManifest().map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers at least 40 API rows', () => {
    expect(buildOneSearchLiveApiManifest().length).toBeGreaterThanOrEqual(40);
  });

  it('each mode tab has core and playback or lane APIs', () => {
    for (const mode of ['all', 'text', 'image', 'audio', 'video', 'file'] as const) {
      const rows = liveApisForMode(mode);
      expect(rows.some((r) => r.group === 'core')).toBe(true);
      expect(rows.length).toBeGreaterThan(5);
    }
  });

  it('lists shipped REST and media endpoints', () => {
    const endpoints = ONE_SEARCH_API_REQUIREMENTS.map((r) => r.endpoint);
    expect(endpoints).toContain('POST /search/query');
    expect(endpoints).toContain('GET /storage/files/{artifact_id}/transcript');
    expect(endpoints).toContain('POST /storage/temp-upload');
    expect(endpoints).toContain('POST /storage/upload/init');
  });

  it('filters APIs by mode tab', () => {
    const imageApis = liveApisForMode('image');
    expect(imageApis.some((r) => r.endpoint.includes('POST /upload'))).toBe(true);
    const textApis = liveApisForMode('text');
    expect(textApis.some((r) => r.toolId.includes('smart_search_text'))).toBe(false);
  });

  it('maps requirement statuses to dev panel statuses', () => {
    expect(mapOneSearchRequirementStatus('live')).toBe('live');
    expect(mapOneSearchRequirementStatus('binding')).toBe('partial');
    expect(mapOneSearchRequirementStatus('missing')).toBe('missing');
  });

  it('assigns every manifest row to a known group', () => {
    const groups = new Set(buildOneSearchLiveApiManifest().map((r) => r.group));
    for (const g of ONE_SEARCH_API_GROUP_ORDER) {
      expect(groups.has(g)).toBe(true);
    }
  });

  it('includes newly audited fallback endpoints', () => {
    const endpoints = ONE_SEARCH_API_REQUIREMENTS.map((r) => r.endpoint);
    expect(endpoints).toContain('POST /memory/search');
    expect(endpoints).toContain('GET /admin/users');
    expect(endpoints).toContain('GET /storage/files/{id}/thumbnail');
  });
});
