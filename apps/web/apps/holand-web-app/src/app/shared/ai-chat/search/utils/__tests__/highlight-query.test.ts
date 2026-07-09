import { describe, expect, it } from 'vitest';
import { splitByQuery, highlightSnippetText } from '../highlight-query';

describe('highlight-query', () => {
  it('splitByQuery marks matching segments', () => {
    const segments = splitByQuery('Hello world', 'wor');
    expect(segments).toEqual([
      { text: 'Hello ', highlight: false },
      { text: 'wor', highlight: true },
      { text: 'ld', highlight: false },
    ]);
  });

  it('returns single non-highlight segment when query empty', () => {
    expect(splitByQuery('abc', '')).toEqual([{ text: 'abc', highlight: false }]);
  });

  it('highlightSnippetText centers match', () => {
    const text = 'x'.repeat(100) + 'needle' + 'y'.repeat(100);
    const snippet = highlightSnippetText(text, 'needle');
    expect(snippet).toContain('needle');
  });
});
