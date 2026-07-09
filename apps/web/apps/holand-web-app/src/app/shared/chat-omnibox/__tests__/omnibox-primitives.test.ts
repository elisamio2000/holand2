import { describe, expect, it } from 'vitest';
import { imageFileFromDataTransfer, omniboxPillClassName } from '@/app/shared/chat-omnibox/omnibox-primitives';

describe('omnibox-primitives', () => {
  it('builds pill class names for drag state', () => {
    expect(omniboxPillClassName(false, false)).toContain('rounded-3xl');
    expect(omniboxPillClassName(true, false)).toContain('ring-primary');
  });

  it('extracts image file from data transfer', () => {
    const dt = {
      files: [
        { type: 'text/plain', name: 'a.txt' },
        { type: 'image/png', name: 'b.png' },
      ],
    } as unknown as DataTransfer;
    expect(imageFileFromDataTransfer(dt)?.name).toBe('b.png');
  });
});
