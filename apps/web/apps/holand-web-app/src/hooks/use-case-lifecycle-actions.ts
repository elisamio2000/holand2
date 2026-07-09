// ============================================
// useCaseLifecycleActions — Shared delete / embed / store / re-analyze handlers
// ============================================

'use client';

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { caseImporterService } from '@/services/case-importer.service';
import { classifyApiError, getApiErrorMessage } from '@/lib/api-errors';

export interface UseCaseLifecycleActionsOptions {
  caseId: string;
  caseName?: string;
  caseRoot?: string;
  status?: string;
  onActionComplete?: () => void;
  onDelete?: () => void;
  confirmDelete?: () => boolean;
  /** When true, confirm embed via getEmbedPreview before POST */
  confirmEmbedPreview?: boolean;
}

export function useCaseLifecycleActions({
  caseId,
  caseName,
  caseRoot,
  status,
  onActionComplete,
  onDelete,
  confirmDelete,
  confirmEmbedPreview = true,
}: UseCaseLifecycleActionsOptions) {
  const { t } = useTranslation();
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const failToast = useCallback(
    (actionKey: string, err: unknown) => {
      const msg = getApiErrorMessage(err);
      toast.error(
        t('caseImporter.actions.toastActionFailed', {
          action: actionKey,
          defaultValue: msg,
        })
      );
    },
    [t]
  );

  const executeAction = useCallback(
    async (
      actionName: string,
      action: () => Promise<unknown>,
      successKey: string
    ) => {
      if (actionInProgress) return;
      setActionInProgress(actionName);

      try {
        await action();
        toast.success(t(successKey));
        onActionComplete?.();
      } catch (err: unknown) {
        console.error('[useCaseLifecycleActions] Action failed:', {
          actionName,
          caseId,
          err,
          category: classifyApiError(err).category,
        });
        failToast(actionName, err);
      } finally {
        setActionInProgress(null);
      }
    },
    [actionInProgress, caseId, failToast, onActionComplete, t]
  );

  const handleEmbed = useCallback(async () => {
    if (actionInProgress) return;

    if (confirmEmbedPreview) {
      setActionInProgress('Embed');
      try {
        const preview = await caseImporterService.getEmbedPreview(caseId);
        const count = preview.task_count ?? preview.tasks?.length ?? 0;
        const ok = window.confirm(
          `${t('caseImporter.actions.embedPreviewTitle')}\n${t(
            'caseImporter.actions.embedPreviewTasks',
            { count }
          )}\n\n${t('caseImporter.actions.embedPreviewConfirm')}`
        );
        if (!ok) {
          setActionInProgress(null);
          return;
        }
      } catch (err: unknown) {
        console.warn('[useCaseLifecycleActions] Embed preview unavailable, continuing:', err);
      }
      setActionInProgress(null);
    }

    return executeAction(
      'Embed',
      () => caseImporterService.embedCase(caseId),
      'caseImporter.actions.toastEmbedStarted'
    );
  }, [actionInProgress, caseId, confirmEmbedPreview, executeAction, t]);

  const handleStore = useCallback(
    () =>
      executeAction(
        'Store',
        () => caseImporterService.storeCase(caseId),
        'caseImporter.actions.toastStoreStarted'
      ),
    [caseId, executeAction]
  );

  const handleReAnalyze = useCallback(
    () =>
      executeAction(
        'Re-analyze',
        () => caseImporterService.reAnalyzeCase(caseId),
        'caseImporter.actions.toastReAnalyzeStarted'
      ),
    [caseId, executeAction]
  );

  const handleCancelQueue = useCallback(
    () =>
      executeAction(
        'Cancel',
        () => caseImporterService.cancelQueuedJob(caseId),
        'caseImporter.actions.toastCancelled'
      ),
    [caseId, executeAction]
  );

  const handlePause = useCallback(
    () =>
      executeAction(
        'Pause',
        async () => {
          const result = await caseImporterService.pauseCase(caseId);
          if (result && result.ok === false) {
            throw new Error(String(result.error || 'pause_failed'));
          }
          return result;
        },
        'caseImporter.actions.toastPaused'
      ),
    [caseId, executeAction]
  );

  const handleResume = useCallback(
    () =>
      executeAction(
        'Resume',
        async () => {
          const result = await caseImporterService.resumeCase(caseId);
          if (result && result.ok === false) {
            throw new Error(String(result.error || 'resume_failed'));
          }
          return result;
        },
        'caseImporter.actions.toastResumed'
      ),
    [caseId, executeAction]
  );

  const handleCancelActive = useCallback(
    () =>
      executeAction(
        'CancelActive',
        () => caseImporterService.cancelActiveImport(caseId),
        'caseImporter.actions.toastActiveCancelled'
      ),
    [caseId, executeAction]
  );

  const handleDelete = useCallback(async () => {
    const confirmed = confirmDelete ? confirmDelete() : true;
    if (!confirmed) return;
    if (actionInProgress) return;

    setActionInProgress('Delete');
    try {
      await caseImporterService.deleteCase(caseId);
      toast.success(t('caseImporter.actions.toastDeleted'));
      if (onDelete) {
        onDelete();
      } else {
        onActionComplete?.();
      }
    } catch (err: unknown) {
      console.error('[useCaseLifecycleActions] Delete failed:', { caseId, err });
      toast.error(t('caseImporter.actions.toastDeleteFailed'));
    } finally {
      setActionInProgress(null);
    }
  }, [actionInProgress, caseId, confirmDelete, onActionComplete, onDelete, t]);

  const isActiveImport =
    status === 'analyzing' ||
    status === 'embedding' ||
    status === 'storing' ||
    status === 'processing' ||
    status === 'pending';

  return {
    actionInProgress,
    isActiveImport,
    handleEmbed,
    handleStore,
    handleReAnalyze,
    handleCancelQueue,
    handlePause,
    handleResume,
    handleCancelActive,
    handleDelete,
  };
}
