/**
 * Detect a single ```mermaid / ```mmd fence inside a markdown code-fence body
 * so we can avoid double-wrapping (markdown header + inner mermaid header).
 */

export type MarkdownMermaidSplit = {
  /** Markdown before the mermaid fence (may be empty) */
  introMd: string;
  /** Raw mermaid diagram source */
  mermaidBody: string;
  /** Markdown after the mermaid fence (may be empty) */
  trailingMd?: string;
};

/**
 * If `md` contains exactly one mermaid fence, returns intro + body (+ optional trailing).
 * Multiple mermaid fences → null (use full MarkdownRenderer on the fence body).
 */
export function splitMarkdownSingleMermaid(md: string): MarkdownMermaidSplit | null {
  const trimmed = md.trim();
  const re = /```(?:mermaid|mmd)\s*\n([\s\S]*?)```/gi;
  const matches = [...trimmed.matchAll(re)];
  if (matches.length !== 1) return null;
  const m = matches[0];
  const idx = m.index ?? 0;
  const intro = trimmed.slice(0, idx).trimEnd();
  const after = trimmed.slice(idx + m[0].length).trim();
  const body = (m[1] ?? '').trim();
  if (!body) return null;

  if (!intro && !after) {
    return { introMd: '', mermaidBody: body };
  }
  if (!intro && after) {
    return { introMd: '', mermaidBody: body, trailingMd: after };
  }
  if (intro && !after) {
    return { introMd: intro.trim(), mermaidBody: body };
  }
  return {
    introMd: intro.trim(),
    mermaidBody: body,
    trailingMd: after,
  };
}
