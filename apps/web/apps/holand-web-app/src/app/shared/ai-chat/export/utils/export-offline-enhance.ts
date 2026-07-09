// ============================================
// Offline HTML enhancement for chat export.
// - Highlights code blocks at export time via highlight.js (bundled dependency).
// - Renders Mermaid fences to inline SVG via mermaid (bundled dependency).
// Result is 100% self-contained: NO CDN, NO runtime <script> needed.
// ============================================

/** Compact GitHub-light highlight.js theme (inlined — no CDN). */
export const HLJS_THEME_CSS = `
  .hljs { color: #24292e; background: transparent; }
  .hljs-comment, .hljs-quote { color: #6a737d; font-style: italic; }
  .hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-type { color: #d73a49; }
  .hljs-string, .hljs-meta .hljs-string, .hljs-regexp { color: #032f62; }
  .hljs-number, .hljs-built_in, .hljs-builtin-name, .hljs-symbol { color: #005cc5; }
  .hljs-title, .hljs-section, .hljs-name { color: #6f42c1; }
  .hljs-attr, .hljs-attribute, .hljs-variable, .hljs-template-variable { color: #e36209; }
  .hljs-tag { color: #22863a; }
  .hljs-deletion { color: #b31d28; background: #ffeef0; }
  .hljs-addition { color: #22863a; background: #f0fff4; }
  .hljs-emphasis { font-style: italic; }
  .hljs-strong { font-weight: 600; }
  pre code.hljs { color: #e2e8f0; }
  pre .hljs-comment, pre .hljs-quote { color: #94a3b8; }
  pre .hljs-keyword, pre .hljs-selector-tag, pre .hljs-literal, pre .hljs-type { color: #f472b6; }
  pre .hljs-string, pre .hljs-regexp { color: #a5d6ff; }
  pre .hljs-number, pre .hljs-built_in, pre .hljs-symbol { color: #79c0ff; }
  pre .hljs-title, pre .hljs-section, pre .hljs-name { color: #d2a8ff; }
  pre .hljs-attr, pre .hljs-attribute, pre .hljs-variable { color: #ffa657; }
  pre .hljs-tag { color: #7ee787; }
  .export-mermaid { margin: 12px 0; text-align: center; }
  .export-mermaid svg { max-width: 100%; height: auto; }
  .export-mermaid-fallback { margin: 12px 0; border: 1px solid #fed7aa; border-radius: 8px; overflow: hidden; }
  .export-mermaid-fallback-head { background: #fff7ed; color: #c2410c; font-size: 11px; font-weight: 600; padding: 6px 12px; }
  .export-mermaid-fallback pre { margin: 0; border-radius: 0; }
`;

function escapeForFallback(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function unescapeHTML(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&');
}

const CODE_BLOCK_RE =
  /<pre(?:\s+data-language="([^"]*)")?>\s*<code(?:\s+class="language-([^"]*)")?>([\s\S]*?)<\/code><\/pre>/g;

/**
 * Enhance export HTML body for fully-offline rendering.
 * @returns enhanced body string (mermaid as SVG, code highlighted inline)
 */
export async function enhanceExportHtmlOffline(body: string): Promise<string> {
  // Collect matches first (async replacement requires pre-collection)
  const matches: Array<{
    full: string;
    lang: string;
    code: string;
  }> = [];

  let m: RegExpExecArray | null;
  CODE_BLOCK_RE.lastIndex = 0;
  while ((m = CODE_BLOCK_RE.exec(body)) !== null) {
    const lang = (m[1] || m[2] || '').toLowerCase();
    matches.push({ full: m[0], lang, code: unescapeHTML(m[3]) });
  }

  if (matches.length === 0) return body;

  let hljs: typeof import('highlight.js').default | null = null;
  try {
    const mod = await import('highlight.js');
    hljs = mod.default ?? (mod as unknown as typeof import('highlight.js').default);
  } catch {
    hljs = null;
  }

  let mermaid: typeof import('mermaid').default | null = null;
  const hasMermaid = matches.some((x) => x.lang === 'mermaid');
  if (hasMermaid) {
    try {
      const mod = await import('mermaid');
      mermaid = mod.default ?? (mod as unknown as typeof import('mermaid').default);
      // Match the app's MermaidBlock config for visual parity.
      const { getMermaidChatInitOptions } = await import(
        '@/app/shared/ai-chat/mermaid-render-config'
      );
      mermaid.initialize(getMermaidChatInitOptions(false));
    } catch {
      mermaid = null;
    }
  }

  // Graceful fallback for invalid Mermaid (e.g. AI-generated bad syntax):
  // show the source in a styled block instead of a "bomb" error SVG.
  const mermaidFallback = (code: string): string =>
    `<div class="export-mermaid-fallback"><div class="export-mermaid-fallback-head">diagram</div>` +
    `<pre><code>${escapeForFallback(code)}</code></pre></div>`;

  let result = body;
  let mermaidSeq = 0;

  for (const match of matches) {
    let replacement: string;

    if (match.lang === 'mermaid') {
      if (!mermaid) {
        replacement = mermaidFallback(match.code);
      } else {
        try {
          // parse() first (like MermaidBlock) — on invalid syntax, fall back
          // to source instead of rendering a bomb error SVG.
          await mermaid.parse(match.code);
          const id = `export-mermaid-${Date.now()}-${mermaidSeq++}`;
          const { svg } = await mermaid.render(id, match.code);
          replacement = `<div class="export-mermaid">${svg}</div>`;
        } catch {
          replacement = mermaidFallback(match.code);
        }
      }
    } else if (hljs) {
      try {
        const highlighted =
          match.lang && hljs.getLanguage(match.lang)
            ? hljs.highlight(match.code, { language: match.lang }).value
            : hljs.highlightAuto(match.code).value;
        const langAttr = match.lang ? ` data-language="${match.lang}"` : '';
        replacement = `<pre${langAttr}><code class="hljs">${highlighted}</code></pre>`;
      } catch {
        replacement = match.full;
      }
    } else {
      replacement = match.full;
    }

    result = result.replace(match.full, replacement);
  }

  return result;
}
