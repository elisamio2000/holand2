import { describe, expect, it } from 'vitest';
import { applyCaseListQuery } from './case-list-query';
import type { CaseListItem } from '@/types/case-importer.types';

const sample: CaseListItem[] = [
  {
    case_id: 'a',
    case_name: 'Alpha',
    status: 'completed',
    progress: 1,
    files_total: 1,
    files_processed: 1,
    user_id: '',
    group_id: '',
    updated_at: 100,
    last_error: '',
  },
  {
    case_id: 'b',
    case_name: 'Beta Failed',
    status: 'failed',
    progress: 0,
    files_total: 0,
    files_processed: 0,
    user_id: '',
    group_id: '',
    updated_at: 200,
    last_error: 'disk full',
  },
];

describe('applyCaseListQuery', () => {
  it('paginates client-side', () => {
    const r = applyCaseListQuery(sample, { page: 1, page_size: 1 });
    expect(r.cases).toHaveLength(1);
    expect(r.count).toBe(2);
    expect(r.total_pages).toBe(2);
  });

  it('filters by status', () => {
    const r = applyCaseListQuery(sample, { status: 'failed' });
    expect(r.cases).toHaveLength(1);
    expect(r.cases[0].case_id).toBe('b');
  });

  it('searches case_name and last_error', () => {
    const r = applyCaseListQuery(sample, { q: 'disk' });
    expect(r.cases).toHaveLength(1);
    expect(r.cases[0].case_id).toBe('b');
  });
});
