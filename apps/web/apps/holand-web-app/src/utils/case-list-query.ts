// Client-side list query until BR-1 server pagination is deployed

import type { CaseListItem, CaseStatus } from '@/types/case-importer.types';

export type CaseListSortField =
  | 'updated_at'
  | 'case_name'
  | 'status'
  | 'progress';

export interface CaseListQueryParams {
  page?: number;
  page_size?: number;
  status?: CaseStatus | 'all';
  q?: string;
  sort?: CaseListSortField;
  order?: 'asc' | 'desc';
}

export interface PaginatedCaseListResult {
  cases: CaseListItem[];
  count: number;
  page: number;
  page_size: number;
  total_pages: number;
}

const ACTIVE_STATUSES = new Set([
  'pending',
  'analyzing',
  'reviewing',
  'embedding',
  'storing',
  'processing',
  'queued',
]);

function matchesSearch(item: CaseListItem, q: string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  return (
    item.case_id.toLowerCase().includes(term) ||
    item.case_name.toLowerCase().includes(term) ||
    (item.last_error || '').toLowerCase().includes(term)
  );
}

function compareItems(
  a: CaseListItem,
  b: CaseListItem,
  sort: CaseListSortField,
  order: 'asc' | 'desc'
): number {
  let cmp = 0;
  switch (sort) {
    case 'case_name':
      cmp = a.case_name.localeCompare(b.case_name);
      break;
    case 'status':
      cmp = String(a.status).localeCompare(String(b.status));
      break;
    case 'progress':
      cmp = (a.progress ?? 0) - (b.progress ?? 0);
      break;
    case 'updated_at':
    default:
      cmp = (a.updated_at ?? 0) - (b.updated_at ?? 0);
      break;
  }
  return order === 'asc' ? cmp : -cmp;
}

/** Apply filter, sort, and pagination on the full in-memory list (BR-1 fallback). */
export function applyCaseListQuery(
  all: CaseListItem[],
  params: CaseListQueryParams = {}
): PaginatedCaseListResult {
  const page = Math.max(1, params.page ?? 1);
  const page_size = Math.min(100, Math.max(1, params.page_size ?? 20));
  const sort = params.sort ?? 'updated_at';
  const order = params.order ?? 'desc';

  let filtered = [...all];

  if (params.status && params.status !== 'all') {
    filtered = filtered.filter((c) => c.status === params.status);
  }

  const query = params.q?.trim();
  if (query) {
    filtered = filtered.filter((c) => matchesSearch(c, query));
  }

  filtered.sort((a, b) => compareItems(a, b, sort, order));

  const count = filtered.length;
  const total_pages = Math.max(1, Math.ceil(count / page_size));
  const safePage = Math.min(page, total_pages);
  const start = (safePage - 1) * page_size;
  const cases = filtered.slice(start, start + page_size);

  return {
    cases,
    count,
    page: safePage,
    page_size,
    total_pages,
  };
}

export function hasActiveCasesInList(cases: CaseListItem[]): boolean {
  return cases.some((c) => ACTIVE_STATUSES.has(String(c.status).toLowerCase()));
}
