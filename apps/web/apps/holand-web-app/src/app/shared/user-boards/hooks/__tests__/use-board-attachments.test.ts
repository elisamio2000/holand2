// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBoardAttachments } from '../use-board-attachments';
import { createEmptySnapshot } from '../../lib/board-snapshot';
import type { BoardAttachmentRef } from '../../lib/board-types';
import { normalizeAttachmentRef } from '../../lib/board-attachment-utils';

vi.mock('@/services/storage.service', () => ({
  storageService: {
    uploadFileSmart: vi.fn(),
    getArtifact: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

const t = (key: string, fallback?: string) => fallback ?? key;

const baseRef = normalizeAttachmentRef({
  id: 'lib-1',
  artifactId: 'art-1',
  name: 'doc.pdf',
  mimeType: 'application/pdf',
  addedAt: '2026-01-01T00:00:00.000Z',
});

describe('useBoardAttachments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('addFromArtifact appends and blocks duplicates', () => {
    const snapshot = createEmptySnapshot();
    snapshot.attachments = [baseRef];
    const onAttachmentsChange = vi.fn();
    const guardMutation = vi.fn(() => true);

    const { result } = renderHook(() =>
      useBoardAttachments({
        snapshot,
        onAttachmentsChange,
        guardMutation,
        t,
      })
    );

    act(() => {
      const added = result.current.addFromArtifact(
        { artifactId: 'art-2', name: 'b.png', mime_type: 'image/png' },
        'system'
      );
      expect(added).not.toBe(false);
    });

    expect(onAttachmentsChange).toHaveBeenCalledTimes(1);
    const next = onAttachmentsChange.mock.calls[0][0] as BoardAttachmentRef[];
    expect(next).toHaveLength(2);
    expect(next[1].artifactId).toBe('art-2');
    expect(next[1].source).toBe('system');

    act(() => {
      const dup = result.current.addFromArtifact(
        { artifactId: 'art-1', name: 'dup' },
        'link'
      );
      expect(dup).toBe(false);
    });
    expect(onAttachmentsChange).toHaveBeenCalledTimes(1);
  });

  it('removeAttachments warns when placed unless removeCanvasPlacements', () => {
    const snapshot = createEmptySnapshot();
    snapshot.attachments = [baseRef];
    snapshot.objects = [
      {
        id: 'm1',
        type: 'media',
        x: 0,
        y: 0,
        width: 100,
        height: 80,
        name: 'doc.pdf',
        mime: 'application/pdf',
        artifactId: 'art-1',
        attachmentRefId: 'lib-1',
      },
    ];
    const onAttachmentsChange = vi.fn();
    const onRemoveCanvasPlacements = vi.fn();
    const guardMutation = vi.fn(() => true);
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    const { result } = renderHook(() =>
      useBoardAttachments({
        snapshot,
        onAttachmentsChange,
        onRemoveCanvasPlacements,
        guardMutation,
        t,
      })
    );

    act(() => {
      result.current.removeAttachments(['lib-1']);
    });
    expect(confirmSpy).toHaveBeenCalled();
    expect(onAttachmentsChange).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    act(() => {
      result.current.removeAttachments(['lib-1']);
    });
    expect(onAttachmentsChange).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.removeAttachments(['lib-1'], {
        removeCanvasPlacements: true,
        skipPlacementCheck: true,
      });
    });
    expect(onRemoveCanvasPlacements).toHaveBeenCalledWith(['lib-1']);

    confirmSpy.mockRestore();
  });

  it('addFromPaste uses paste source', async () => {
    const { storageService } = await import('@/services/storage.service');
    vi.mocked(storageService.uploadFileSmart).mockResolvedValue({
      uploaded: [{ id: 'art-paste' }],
    } as never);

    const snapshot = createEmptySnapshot();
    const onAttachmentsChange = vi.fn();
    const { result } = renderHook(() =>
      useBoardAttachments({
        snapshot,
        onAttachmentsChange,
        guardMutation: () => true,
        t,
      })
    );

    await act(async () => {
      const file = new File(['x'], 'clip.png', { type: 'image/png' });
      const ref = await result.current.addFromPaste(file);
      expect(ref).not.toBe(false);
    });

    const next = onAttachmentsChange.mock.calls[0][0] as BoardAttachmentRef[];
    expect(next[0].source).toBe('paste');
  });
});
