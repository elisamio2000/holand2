import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ADVANCED_FILTERS,
  advancedFiltersToRequest,
  applyAdvancedFiltersToResponse,
  hasActiveAdvancedFilters,
} from '../advanced-search-filters';
import type { OneSearchResponse } from '@/types/one-search.types';

describe('advanced-search-filters', () => {
  it('maps sidebar filters to OneSearchRequest fields', () => {
    const req = advancedFiltersToRequest({
      ...DEFAULT_ADVANCED_FILTERS,
      lanes: ['chat', 'files'],
      fileTypes: ['pdf'],
      sortBy: 'date_desc',
      minScore: 0.5,
    });
    expect(req.filters?.lanes).toEqual(['chat', 'files']);
    expect(req.filters?.fileTypes).toEqual(['pdf']);
    expect(req.sort).toBe('date_desc');
    expect(req.scoreThreshold).toBe(0.5);
  });

  it('applies lane filter client-side', () => {
    const response: OneSearchResponse = {
      query: 'test',
      mode: 'all',
      total: 2,
      tookMs: 1,
      lanes: [
        { lane: 'chat', hits: [{ id: 'c1', title: 'chat hit' }], total: 1 },
        { lane: 'files', hits: [{ id: 'f1', title: 'file.pdf', meta: { mime: 'application/pdf' } }], total: 1 },
      ],
    };
    const filtered = applyAdvancedFiltersToResponse(response, {
      ...DEFAULT_ADVANCED_FILTERS,
      lanes: ['files'],
    });
    expect(filtered.lanes.find((l) => l.lane === 'chat')?.hits).toHaveLength(0);
    expect(filtered.lanes.find((l) => l.lane === 'files')?.hits).toHaveLength(1);
  });

  it('detects active filters', () => {
    expect(hasActiveAdvancedFilters(DEFAULT_ADVANCED_FILTERS)).toBe(false);
    expect(
      hasActiveAdvancedFilters({ ...DEFAULT_ADVANCED_FILTERS, fileTypes: ['pdf'] })
    ).toBe(true);
  });
});
