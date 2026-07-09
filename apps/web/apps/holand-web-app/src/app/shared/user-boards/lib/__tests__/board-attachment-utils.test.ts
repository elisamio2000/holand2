import { describe, expect, it } from 'vitest';
import { createEmptySnapshot, normalizeBoardSnapshot } from '../board-snapshot';
import {
  deriveAttachmentCategory,
  filterAttachments,
  isDuplicateArtifact,
  normalizeAttachmentRef,
  resolveCaseFilePrefix,
  sortAttachments,
} from '../board-attachment-utils';

describe('board-attachment-utils', () => {
  it('migrates legacy attachment refs on normalize', () => {
    const snap = normalizeBoardSnapshot({
      version: 1,
      viewBox: createEmptySnapshot().viewBox,
      objects: [],
      attachments: [
        {
          id: 'a1',
          artifactId: 'art-1',
          name: 'photo.png',
          mime: 'image/png',
          addedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
    expect(snap.attachments).toHaveLength(1);
    expect(snap.attachments![0].source).toBe('upload');
    expect(snap.attachments![0].mimeType).toBe('image/png');
    expect(snap.attachments![0].category).toBe('image');
  });

  it('deriveAttachmentCategory maps mime types', () => {
    expect(deriveAttachmentCategory('image/jpeg')).toBe('image');
    expect(deriveAttachmentCategory('video/mp4')).toBe('video');
    expect(deriveAttachmentCategory('application/pdf')).toBe('document');
    expect(deriveAttachmentCategory('application/zip')).toBe('archive');
  });

  it('isDuplicateArtifact detects existing artifactId', () => {
    const list = [
      normalizeAttachmentRef({
        id: '1',
        artifactId: 'x',
        name: 'a',
        addedAt: '2026-01-01',
      }),
    ];
    expect(isDuplicateArtifact(list, 'x')).toBe(true);
    expect(isDuplicateArtifact(list, 'y')).toBe(false);
  });

  it('filter and sort attachments', () => {
    const list = [
      normalizeAttachmentRef({
        id: '1',
        artifactId: 'a',
        name: 'beta.pdf',
        mimeType: 'application/pdf',
        size: 200,
        addedAt: '2026-01-02',
      }),
      normalizeAttachmentRef({
        id: '2',
        artifactId: 'b',
        name: 'alpha.png',
        mimeType: 'image/png',
        size: 100,
        addedAt: '2026-01-01',
      }),
    ];
    const filtered = filterAttachments(list, { category: 'image' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].name).toBe('alpha.png');
    const sorted = sortAttachments(list, 'name-asc');
    expect(sorted[0].name).toBe('alpha.png');
  });

  it('resolveCaseFilePrefix builds importer path', () => {
    expect(resolveCaseFilePrefix('cas_123')).toBe('case_importer/cas_123/');
    expect(resolveCaseFilePrefix('/cas_456/')).toBe('case_importer/cas_456/');
  });

  it('isCasePrefixValid rejects empty case ids', async () => {
    const { isCasePrefixValid } = await import('../board-attachment-utils');
    expect(isCasePrefixValid('cas_1')).toBe(true);
    expect(isCasePrefixValid('')).toBe(false);
    expect(isCasePrefixValid('   ')).toBe(false);
    expect(isCasePrefixValid(undefined)).toBe(false);
  });
});
