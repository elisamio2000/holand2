/**
 * Heuristics for treating a fenced code block as markdown document content
 * (render with MarkdownRenderer) instead of syntax-highlighted source.
 */

const MERMAID_FENCE = /```(?:mermaid|mmd)\b/i;
const NESTED_FENCE = /```(?:markdown|md|gfm|mermaid|mmd)\b/i;

export function looksLikeMarkdownDocument(source: string): boolean {
  const s = source.trim();
  if (!s) return false;
  if (MERMAID_FENCE.test(s) && (s.includes('\n') || s.length > 80)) return true;
  if (NESTED_FENCE.test(s)) return true;
  if (/^#{1,6}\s+\S/m.test(s)) return true;
  if (/^\s*[-*+]\s+\S/m.test(s)) return true;
  if (/^\s*\d+\.\s+\S/m.test(s)) return true;
  if (/\n#{1,6}\s+\S/.test(s)) return true;
  return false;
}

export function isMarkdownFenceLanguage(lang?: string): boolean {
  if (!lang) return false;
  const l = lang.toLowerCase();
  return l === 'markdown' || l === 'md' || l === 'gfm' || l === 'commonmark' || l === 'mdx';
}

/** Should this fenced block body be rendered as markdown (not Prism)? */
export function shouldRenderFenceAsMarkdown(language: string | undefined, body: string): boolean {
  if (isMarkdownFenceLanguage(language)) return true;
  if (!language || language === 'text' || language === 'txt' || language === 'plaintext') {
    return looksLikeMarkdownDocument(body);
  }
  return false;
}
