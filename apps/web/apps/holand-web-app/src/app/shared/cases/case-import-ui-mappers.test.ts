import { describe, expect, it } from 'vitest';
import {
  normalizeCaseListItem,
  normalizeCaseList,
  summarizeQueueStatus,
  applyGhostFlags,
} from './case-import-ui-mappers';

describe('normalizeCaseListItem', () => {
  it('maps snake_case list row', () => {
    const row = normalizeCaseListItem({
      case_id: 'cas_abc',
      case_name: 'Test Case',
      status: 'completed',
      progress: 1,
      files_total: 10,
      files_processed: 10,
      updated_at: 1717200000,
      detail_available: true,
    });
    expect(row?.case_id).toBe('cas_abc');
    expect(row?.files_total).toBe(10);
    expect(row?.detail_available).toBe(true);
  });

  it('returns null without case_id', () => {
    expect(normalizeCaseListItem({ case_name: 'x' })).toBeNull();
  });
});

describe('normalizeCaseList', () => {
  it('dedupes by case_id keeping newest updated_at', () => {
    const list = normalizeCaseList({
      cases: [
        { case_id: 'a', case_name: 'A', status: 'pending', progress: 0, updated_at: 1 },
        { case_id: 'a', case_name: 'A2', status: 'completed', progress: 1, updated_at: 2 },
      ],
    });
    expect(list).toHaveLength(1);
    expect(list[0].status).toBe('completed');
  });
});

describe('summarizeQueueStatus', () => {
  it('reads queue_size and active_count', () => {
    const s = summarizeQueueStatus({
      queue_size: 3,
      active_count: 1,
      max_concurrent: 2,
    });
    expect(s.show).toBe(true);
    expect(s.queued).toBe(3);
    expect(s.active).toBe(1);
    expect(s.capacity).toBe(2);
  });
});

describe('applyGhostFlags', () => {
  it('marks detail_available false when flagged', () => {
    const cases = applyGhostFlags([
      {
        case_id: 'g1',
        case_name: 'Ghost',
        status: 'completed',
        progress: 1,
        files_total: 0,
        files_processed: 0,
        user_id: '',
        group_id: '',
        updated_at: 0,
        last_error: '',
        detail_available: false,
      },
    ]);
    expect(cases[0].detail_available).toBe(false);
  });
});
