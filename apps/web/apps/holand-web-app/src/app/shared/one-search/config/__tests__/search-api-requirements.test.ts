import { describe, expect, it } from 'vitest';
import { ONE_SEARCH_API_REQUIREMENTS } from '../search-api-requirements';

describe('ONE_SEARCH_API_REQUIREMENTS', () => {
  it('marks binding-only rows for semantic and visual sub-tools', () => {
    const text = ONE_SEARCH_API_REQUIREMENTS.find((r) => r.toolId === 'plugin.smart_search_text');
    const visual = ONE_SEARCH_API_REQUIREMENTS.find(
      (r) => r.toolId === 'plugin.smart_search_image_by_example'
    );
    expect(text?.requirementStatus).toBe('binding');
    expect(visual?.requirementStatus).toBe('binding');
  });

  it('marks resolved integration items', () => {
    const resolved = ONE_SEARCH_API_REQUIREMENTS.filter((r) => r.requirementStatus === 'resolved');
    const toolIds = resolved.map((r) => r.toolId);
    expect(toolIds).toContain('chat.upload');
    expect(toolIds).toContain('smart_search.exclude_query_artifact');
    expect(toolIds).toContain('smart_search.args.filters_sort_pagination');
  });
});
