export interface TextSegment {
  text: string;
  highlight: boolean;
}

export function splitByQuery(text: string, query: string): TextSegment[] {
  const q = query.trim();
  if (!q || !text) return [{ text, highlight: false }];

  const lower = text.toLowerCase();
  const qLower = q.toLowerCase();
  const segments: TextSegment[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const idx = lower.indexOf(qLower, cursor);
    if (idx < 0) {
      segments.push({ text: text.slice(cursor), highlight: false });
      break;
    }
    if (idx > cursor) {
      segments.push({ text: text.slice(cursor, idx), highlight: false });
    }
    segments.push({ text: text.slice(idx, idx + q.length), highlight: true });
    cursor = idx + q.length;
  }

  return segments.length > 0 ? segments : [{ text, highlight: false }];
}

export function highlightSnippetText(text: string, query: string, maxLen = 120): string {
  const lower = text.toLowerCase();
  const q = query.toLowerCase();
  const idx = lower.indexOf(q);
  if (idx < 0) return text.slice(0, maxLen);
  const start = Math.max(0, idx - 40);
  const end = Math.min(text.length, idx + query.length + 40);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}
