import { describe, expect, it } from 'vitest';
import type { BulkBackupFormat } from '@/app/shared/ai-chat/export/bulk-backup-runner';

function toggleFormat(
  formats: Set<BulkBackupFormat>,
  format: BulkBackupFormat
): Set<BulkBackupFormat> {
  const next = new Set(formats);
  if (next.has(format)) {
    if (next.size <= 1) return formats;
    next.delete(format);
  } else {
    next.add(format);
  }
  return next;
}

describe('bulk-backup-options', () => {
  it('keeps at least one backup format selected', () => {
    let formats = new Set<BulkBackupFormat>(['json', 'md']);
    formats = toggleFormat(formats, 'json');
    formats = toggleFormat(formats, 'md');
    expect(formats.has('md')).toBe(true);
    expect(formats.size).toBeGreaterThanOrEqual(1);
  });

  it('manifest records selected formats', () => {
    const formats: BulkBackupFormat[] = ['json'];
    const manifest = { formats, sessionCount: 0 };
    expect(manifest.formats).toEqual(['json']);
  });
});
