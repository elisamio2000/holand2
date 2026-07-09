// ============================================
// Markdown Helpers — Markdown -> HTML/plain text for export
// Block-aware parser: headings, fenced code (with language class),
// tables (GFM), ordered/unordered lists, blockquotes, hr, paragraphs.
// Inline: bold, italic, inline code, links, images.
// ============================================

export function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function parseInline(text: string): string {
  let out = escapeHTML(text);

  // Images: ![alt](src)
  out = out.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_m, alt, src) => `<img src="${src}" alt="${alt}" loading="lazy" />`
  );

  // Links: [text](href)
  out = out.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_m, label, href) => `<a href="${href}">${label}</a>`
  );

  // Inline code (before bold/italic so * inside code is safe)
  out = out.replace(/`([^`]+)`/g, (_m, code) => `<code>${code}</code>`);

  // Bold
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/__([^_]+)__/g, '<strong>$1</strong>');

  // Italic
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  out = out.replace(/(^|[^_])_([^_]+)_/g, '$1<em>$2</em>');

  // Strikethrough
  out = out.replace(/~~([^~]+)~~/g, '<del>$1</del>');

  return out;
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
  if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
  return trimmed.split('|').map((cell) => cell.trim());
}

/**
 * Convert markdown to HTML suitable for self-contained export.
 * Code fences emit `<pre data-language="x"><code class="language-x">…</code></pre>`
 * so export-time highlighting / mermaid extraction can target them.
 */
export function markdownToHTML(markdown: string): string {
  if (!markdown) return '';

  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  let i = 0;
  // list stack tracks open list types for nesting by indentation
  const listStack: Array<{ type: 'ul' | 'ol'; indent: number }> = [];

  function closeListsTo(indent: number) {
    while (
      listStack.length > 0 &&
      listStack[listStack.length - 1].indent >= indent
    ) {
      const last = listStack.pop()!;
      html.push(`</${last.type}>`);
    }
  }

  function closeAllLists() {
    while (listStack.length > 0) {
      const last = listStack.pop()!;
      html.push(`</${last.type}>`);
    }
  }

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    const fenceMatch = line.match(/^\s*```\s*([\w-]*)\s*$/);
    if (fenceMatch) {
      closeAllLists();
      const lang = fenceMatch[1] || '';
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      const langAttr = lang ? ` data-language="${lang}"` : '';
      const codeClass = lang ? ` class="language-${lang}"` : '';
      html.push(
        `<pre${langAttr}><code${codeClass}>${escapeHTML(
          codeLines.join('\n')
        )}</code></pre>`
      );
      continue;
    }

    // Horizontal rule
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      closeAllLists();
      html.push('<hr />');
      i++;
      continue;
    }

    // Headings
    const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      closeAllLists();
      const level = headingMatch[1].length;
      html.push(`<h${level}>${parseInline(headingMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // GFM table: header row + separator
    if (
      line.includes('|') &&
      i + 1 < lines.length &&
      isTableSeparator(lines[i + 1])
    ) {
      closeAllLists();
      const headers = splitRow(line);
      i += 2; // skip header + separator
      const bodyRows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) {
        bodyRows.push(splitRow(lines[i]));
        i++;
      }
      let table = '<table><thead><tr>';
      table += headers.map((h) => `<th>${parseInline(h)}</th>`).join('');
      table += '</tr></thead><tbody>';
      for (const row of bodyRows) {
        table += '<tr>';
        table += row.map((c) => `<td>${parseInline(c)}</td>`).join('');
        table += '</tr>';
      }
      table += '</tbody></table>';
      html.push(table);
      continue;
    }

    // Blockquote (collapse consecutive lines)
    if (/^\s*>\s?/.test(line)) {
      closeAllLists();
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quoteLines.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      html.push(`<blockquote>${parseInline(quoteLines.join(' '))}</blockquote>`);
      continue;
    }

    // List item (ordered or unordered) with indentation-based nesting
    const listMatch = line.match(/^(\s*)([*+-]|\d+\.)\s+(.*)$/);
    if (listMatch) {
      const indent = listMatch[1].length;
      const isOrdered = /\d+\./.test(listMatch[2]);
      const type: 'ul' | 'ol' = isOrdered ? 'ol' : 'ul';

      if (
        listStack.length === 0 ||
        indent > listStack[listStack.length - 1].indent
      ) {
        html.push(`<${type}>`);
        listStack.push({ type, indent });
      } else {
        closeListsTo(indent + 1);
        if (
          listStack.length === 0 ||
          listStack[listStack.length - 1].indent < indent
        ) {
          html.push(`<${type}>`);
          listStack.push({ type, indent });
        }
      }

      html.push(`<li>${parseInline(listMatch[3])}</li>`);
      i++;
      continue;
    }

    // Blank line — paragraph break
    if (!line.trim()) {
      closeAllLists();
      i++;
      continue;
    }

    // Paragraph (merge consecutive non-empty, non-block lines)
    closeAllLists();
    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s*#{1,6}\s/.test(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !/^(\s*)([*+-]|\d+\.)\s+/.test(lines[i]) &&
      !(lines[i].includes('|') && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    html.push(`<p>${parseInline(paraLines.join('<br />'))}</p>`);
  }

  closeAllLists();
  return html.join('\n');
}

export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/^\s*[*+-]\s/gm, '• ')
    .replace(/^\s*\d+\.\s/gm, '')
    .replace(/\|/g, ' ')
    .trim();
}

export function extractCodeBlocks(markdown: string): Array<{
  language: string;
  code: string;
}> {
  const codeBlocks: Array<{ language: string; code: string }> = [];
  const regex = /```(\w+)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    codeBlocks.push({
      language: match[1] || 'text',
      code: match[2].trim(),
    });
  }
  return codeBlocks;
}
