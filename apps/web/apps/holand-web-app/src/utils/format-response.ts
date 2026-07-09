// ============================================
// formatResponse — Auto-detect and format unformatted code
// Converts plain HTML/JS/Python to markdown code blocks
// ============================================

/**
 * Auto-detect and wrap code blocks if the AI returned plain text code.
 * 
 * This is a WORKAROUND for backends that don't return proper markdown.
 * Ideally, the backend should return properly formatted markdown.
 *
 * @param text - Raw response text from backend
 * @returns Formatted markdown text
 *
 * @example
 * ```typescript
 * const raw = "<!DOCTYPE html>\n<html>...</html>";
 * const formatted = formatResponse(raw);
 * // Returns: "```html\n<!DOCTYPE html>\n<html>...</html>\n```"
 * ```
 */
export function formatResponse(text: string): string {
  console.info('[formatResponse] Processing response:', {
    length: text.length,
    preview: text.substring(0, 100),
  });

  // If already contains code blocks, return as-is
  if (text.includes('```')) {
    console.info('[formatResponse] Already contains code blocks, skipping');
    return text;
  }

  let formatted = text;

  // Detect and wrap HTML code
  // Pattern: starts with <!DOCTYPE or <html or <HTML
  const htmlPattern = /^(\s*)(<! DOCTYPE|<html|<HTML)/i;
  if (htmlPattern.test(text)) {
    console.info('[formatResponse] Detected plain HTML, wrapping in code block');
    formatted = `\`\`\`html\n${text}\n\`\`\``;
    return formatted;
  }

  // Detect and wrap JavaScript code
  // Pattern: contains function/const/let declarations
  const jsPattern = /(function\s+\w+|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=)/;
  if (jsPattern.test(text) && !text.includes('```')) {
    console.info('[formatResponse] Detected plain JavaScript, wrapping in code block');
    formatted = `\`\`\`javascript\n${text}\n\`\`\``;
    return formatted;
  }

  // Detect and wrap Python code
  // Pattern: contains def/class/import
  const pythonPattern = /(def\s+\w+|class\s+\w+|import\s+\w+|from\s+\w+\s+import)/;
  if (pythonPattern.test(text)) {
    console.info('[formatResponse] Detected plain Python, wrapping in code block');
    formatted = `\`\`\`python\n${text}\n\`\`\``;
    return formatted;
  }

  // Detect and wrap JSON
  // Pattern: starts with { or [ and ends with } or ]
  const jsonPattern = /^\s*[{\[]/;
  const jsonEndPattern = /[}\]]\s*$/;
  if (jsonPattern.test(text) && jsonEndPattern.test(text)) {
    try {
      // Verify it's valid JSON
      JSON.parse(text);
      console.info('[formatResponse] Detected plain JSON, wrapping in code block');
      formatted = `\`\`\`json\n${text}\n\`\`\``;
      return formatted;
    } catch (e) {
      // Not valid JSON, skip
    }
  }

  // Detect and wrap CSS
  // Pattern: contains CSS selectors and rules
  const cssPattern = /([.#]?\w+\s*\{[^}]+\})/;
  if (cssPattern.test(text)) {
    console.info('[formatResponse] Detected plain CSS, wrapping in code block');
    formatted = `\`\`\`css\n${text}\n\`\`\``;
    return formatted;
  }

  // Detect multi-line code without proper formatting
  // If response has more than 5 lines and no markdown, might be code
  const lines = text.split('\n');
  if (lines.length > 5 && !text.match(/^#+ /m)) {
    // Check if most lines are indented (sign of code)
    const indentedLines = lines.filter((line) =>
      line.match(/^\s{2,}/) || line.match(/^\t/)
    );
    if (indentedLines.length > lines.length * 0.5) {
      console.info('[formatResponse] Detected indented code block, wrapping');
      formatted = `\`\`\`\n${text}\n\`\`\``;
      return formatted;
    }
  }

  console.info('[formatResponse] No auto-formatting needed');
  return formatted;
}
