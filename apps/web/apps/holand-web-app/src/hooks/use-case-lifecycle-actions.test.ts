/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCaseLifecycleActions } from './use-case-lifecycle-actions';

const pauseCaseMock = vi.fn();
const resumeCaseMock = vi.fn();
const cancelActiveImportMock = vi.fn();

vi.mock('@/services/case-importer.service', () => ({
  caseImporterService: {
    pauseCase: (...args: unknown[]) => pauseCaseMock(...args),
    resumeCase: (...args: unknown[]) => resumeCaseMock(...args),
    cancelActiveImport: (...args: unknown[]) => cancelActiveImportMock(...args),
    embedCase: vi.fn(),
    storeCase: vi.fn(),
    deleteCase: vi.fn(),
    cancelQueuedJob: vi.fn(),
    reviewFiles: vi.fn(),
    getEmbedPreview: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('useCaseLifecycleActions', () => {
  beforeEach(() => {
    pauseCaseMock.mockReset();
    resumeCaseMock.mockReset();
    cancelActiveImportMock.mockReset();
    pauseCaseMock.mockResolvedValue({ ok: true });
    resumeCaseMock.mockResolvedValue({ ok: true });
    cancelActiveImportMock.mockResolvedValue({ ok: true });
  });

  it('calls pauseCase when handlePause runs', async () => {
    const { result } = renderHook(() =>
      useCaseLifecycleActions({
        caseId: 'cas_test123',
        status: 'analyzing',
      })
    );

    await act(async () => {
      await result.current.handlePause();
    });

    expect(pauseCaseMock).toHaveBeenCalledWith('cas_test123');
  });

  it('calls resumeCase when handleResume runs', async () => {
    const { result } = renderHook(() =>
      useCaseLifecycleActions({
        caseId: 'cas_test123',
        status: 'analyzing',
      })
    );

    await act(async () => {
      await result.current.handleResume();
    });

    expect(resumeCaseMock).toHaveBeenCalledWith('cas_test123');
  });

  it('calls cancelActiveImport when handleCancelActive runs', async () => {
    const { result } = renderHook(() =>
      useCaseLifecycleActions({
        caseId: 'cas_test123',
        status: 'analyzing',
      })
    );

    await act(async () => {
      await result.current.handleCancelActive();
    });

    expect(cancelActiveImportMock).toHaveBeenCalledWith('cas_test123');
  });
});
