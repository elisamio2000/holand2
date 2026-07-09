import { describe, expect, it } from 'vitest';
import { deriveCaseSummaryFromDetail } from './case-summary-provider';
import type { CaseDetail } from '@/types/case-importer.types';

describe('deriveCaseSummaryFromDetail', () => {
  it('builds summary from detail files and status', () => {
    const detail: CaseDetail = {
      case_id: 'cas_1',
      case_name: 'Demo',
      case_root: '/data',
      status: 'completed',
      ok: true,
      progress: 1,
      session_id: '',
      user_id: 'u1',
      group_id: 'g1',
      files_total: 2,
      files_done: 2,
      files_error: 0,
      qdrant_vectors_count: 100,
      error: '',
      created_at: 0,
      updated_at: 1717200000,
      files: [
        {
          artifact_id: 'art1',
          relative_path: 'a.jpg',
          source_path: '',
          case_path: 'a.jpg',
          folder_id: '',
          kind: 'image',
          media_type: 'image',
          size_bytes: 100,
          status: 'ok',
          has_extension: true,
          planned_tools: [],
          tools: [
            {
              tool_id: 'plugin_image',
              ok: true,
              result: {},
              error: null,
              elapsed_ms: 12,
            },
          ],
          errors: [],
        },
      ],
      logs: [
        {
          ts: 1717200100,
          level: 'info',
          scope: 'case',
          message: 'Import finished',
          data: {},
        },
      ],
    };
    const s = deriveCaseSummaryFromDetail(detail);
    expect(s.source).toBe('derived');
    expect(s.executive_summary).toContain('Demo');
    expect(s.key_findings.length).toBeGreaterThan(0);
  });
});
