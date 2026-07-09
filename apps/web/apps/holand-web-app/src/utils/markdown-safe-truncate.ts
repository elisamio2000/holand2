/**
 * Truncate assistant markdown for preview without breaking fenced code blocks
 * (which breaks Mermaid / nested markdown rendering).
 */

export function truncateMarkdownForPreview(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;

  let cut = maxChars;
  const before = content.slice(0, cut);
  const fenceTicks = (before.match(/```/g) || []).length;

  // Odd count → inside an unclosed fenced block; cut before it opened
  if (fenceTicks % 2 !== 0) {
    const lastOpen = before.lastIndexOf('```');
    if (lastOpen > maxChars * 0.35) cut = lastOpen;
  } else {
    const lastPara = before.lastIndexOf('\n\n');
    if (lastPara > maxChars * 0.5) cut = lastPara;
  }

  return content.slice(0, cut).trimEnd() + '\n\n…';
}
