/**
 * When chat markdown is truncated, per-fence copy should prefer the complete fence body
 * from the full message if we can match the rendered (possibly partial) block.
 */
export function chooseFenceBodyForCopy(
  blockBody: string,
  fullMarkdown?: string | null
): string {
  const block = blockBody.replace(/\n$/, '').trimEnd();
  if (!fullMarkdown || !block) return blockBody;
  const re = /```[^\n`]*\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fullMarkdown))) {
    const raw = m[1] ?? '';
    const body = raw.replace(/\n$/, '').trimEnd();
    if (body === block) return raw.replace(/\n$/, '');
    if (body.startsWith(block) && block.length >= 24) return raw.replace(/\n$/, '');
    if (block.length >= 24 && block.startsWith(body.slice(0, Math.min(80, body.length)))) {
      return raw.replace(/\n$/, '');
    }
  }
  return blockBody;
}
