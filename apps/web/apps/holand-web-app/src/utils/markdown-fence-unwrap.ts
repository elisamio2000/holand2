/**
 * Normalize assistant markdown that incorrectly wraps Mermaid in ```markdown fences.
 * Fixes render (empty nodes) and copy (double-wrapped fences).
 */

const MD_WRAP_RE =
  /```(?:markdown|md|gfm)\s*\n(```(?:mermaid|mmd)[\s\S]*?```)\s*\n```/gi;

/** Unwrap ```markdown\n```mermaid\n...\n```\n``` → ```mermaid\n...\n``` */
export function unwrapMarkdownWrappedMermaidFences(source: string): string {
  let s = source;
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(MD_WRAP_RE, '$1');
  }
  return s;
}

/** Strip outer ```markdown``` wrapper when it wraps the entire body. */
export function unwrapOuterMarkdownFence(source: string): string {
  let s = source.trim();
  let prev = '';
  while (prev !== s) {
    prev = s;
    const m = s.match(/^```(?:markdown|md|gfm)\s*\n([\s\S]*?)\n```\s*$/i);
    if (m) s = m[1].trim();
  }
  return s;
}

/** Full pipeline for render / copy. */
export function prepareMarkdownForRender(source: string): string {
  return unwrapOuterMarkdownFence(unwrapMarkdownWrappedMermaidFences(source));
}

/** Inner Mermaid source when body is only a single ```mermaid fence. */
export function extractSingleMermaidBody(source: string): string | null {
  const s = source.trim();
  const m = s.match(/^```(?:mermaid|mmd)\s*\n([\s\S]*?)\n```\s*$/i);
  return m ? m[1].trim() : null;
}

/** Clipboard: ```mermaid fence for a diagram source string. */
export function formatMermaidFenceForCopy(source: string): string {
  const body = source.trim();
  return `\`\`\`mermaid\n${body}\n\`\`\``;
}

/** Clipboard: fix assistant messages before copy-to-clipboard. */
export function normalizeAssistantMessageForCopy(content: string): string {
  return prepareMarkdownForRender(content);
}
