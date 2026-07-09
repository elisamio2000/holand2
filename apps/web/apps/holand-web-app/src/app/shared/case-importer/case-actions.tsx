// ============================================
// CaseActions — Action buttons for case operations
// Provides context-aware buttons based on current case status
// ============================================

'use client';

import { useState } from 'react';
import { Button, Loader, Text } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiCubeDuotone,
  PiFloppyDiskDuotone,
  PiArrowClockwiseDuotone,
  PiTrashDuotone,
  PiStopCircleDuotone,
  PiPauseDuotone,
  PiPlayDuotone,
} from 'react-icons/pi';
import { useTranslation } from 'react-i18next';
import { useCaseLifecycleActions } from '@/hooks/use-case-lifecycle-actions';
import ConfirmDeleteModal from '@/app/shared/cases/confirm-delete-modal';
import type { CaseStatus } from '@/types/case-importer.types';

export default function CaseActions({
  caseId,
  caseName,
  caseRoot,
  status,
  queuePosition,
  onActionComplete,
  onDelete,
  className,
}: {
  caseId: string;
  caseName?: string;
  caseRoot?: string;
  status: CaseStatus;
  queuePosition?: number;
  onActionComplete?: () => void;
  onDelete?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const {
    actionInProgress,
    handleEmbed,
    handleStore,
    handleReAnalyze,
    handleCancelQueue,
    handlePause,
    handleResume,
    handleCancelActive,
    handleDelete,
  } = useCaseLifecycleActions({
    caseId,
    caseName,
    caseRoot,
    status,
    onActionComplete,
    onDelete: () => {
      setDeleteOpen(false);
      onDelete?.();
    },
  });

  const ActionButton = ({
    actionName,
    onClick,
    icon,
    label,
    variant = 'outline',
    color,
  }: {
    actionName: string;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    variant?: 'solid' | 'outline' | 'flat';
    color?: 'primary' | 'danger' | 'secondary';
  }) => (
    <Button
      variant={variant}
      color={color}
      onClick={onClick}
      disabled={actionInProgress !== null}
      className="min-w-[110px]"
    >
      {actionInProgress === actionName ? (
        <Loader variant="spinner" size="sm" className="me-1.5" />
      ) : (
        <span className="me-1.5">{icon}</span>
      )}
      {label}
    </Button>
  );

  const isQueued = queuePosition !== undefined && queuePosition > 0;
  const isPaused = status === 'paused';
  const isActive =
    status === 'analyzing' ||
    status === 'embedding' ||
    status === 'storing' ||
    status === 'security';

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {isQueued && (
          <ActionButton
            actionName="Cancel"
            onClick={handleCancelQueue}
            icon={<PiStopCircleDuotone className="h-4 w-4" />}
            label={t('caseImporter.actions.cancelQueue')}
            color="danger"
            variant="outline"
          />
        )}

        {(status === 'analyzing' || status === 'pending') && !isActive && (
          <ActionButton
            actionName="Embed"
            onClick={handleEmbed}
            icon={<PiCubeDuotone className="h-4 w-4" />}
            label={t('caseImporter.actions.startEmbed')}
            variant="solid"
            color="primary"
          />
        )}

        {status === 'embedding' && !isActive && (
          <ActionButton
            actionName="Store"
            onClick={handleStore}
            icon={<PiFloppyDiskDuotone className="h-4 w-4" />}
            label={t('caseImporter.actions.startStore')}
            variant="solid"
            color="primary"
          />
        )}

        {status === 'failed' && (
          <ActionButton
            actionName="Re-analyze"
            onClick={handleReAnalyze}
            icon={<PiArrowClockwiseDuotone className="h-4 w-4" />}
            label={t('caseImporter.actions.reAnalyze')}
            variant="outline"
          />
        )}

        {!isActive && !isPaused && (
          <ActionButton
            actionName="Delete"
            onClick={() => setDeleteOpen(true)}
            icon={<PiTrashDuotone className="h-4 w-4" />}
            label={t('common.delete')}
            color="danger"
            variant="flat"
          />
        )}

        {isActive && (
          <>
            <ActionButton
              actionName="Pause"
              onClick={handlePause}
              icon={<PiPauseDuotone className="h-4 w-4" />}
              label={t('caseImporter.actions.pause')}
              variant="outline"
            />
            <ActionButton
              actionName="CancelActive"
              onClick={handleCancelActive}
              icon={<PiStopCircleDuotone className="h-4 w-4" />}
              label={t('caseImporter.actions.cancelActive')}
              color="danger"
              variant="outline"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Loader variant="spinner" size="sm" />
              <Text>{t('caseImporter.actions.processing')}</Text>
            </div>
          </>
        )}

        {isPaused && (
          <>
            <ActionButton
              actionName="Resume"
              onClick={handleResume}
              icon={<PiPlayDuotone className="h-4 w-4" />}
              label={t('caseImporter.actions.resume')}
              variant="solid"
              color="primary"
            />
            <ActionButton
              actionName="CancelActive"
              onClick={handleCancelActive}
              icon={<PiStopCircleDuotone className="h-4 w-4" />}
              label={t('caseImporter.actions.cancelActive')}
              color="danger"
              variant="outline"
            />
          </>
        )}
      </div>

      <ConfirmDeleteModal
        isOpen={deleteOpen}
        onClose={() => !actionInProgress && setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={t('caseImporter.list.deleteConfirmTitle')}
        message={t('caseImporter.list.deleteConfirmMessage', {
          name: caseName || caseId,
        })}
        loading={actionInProgress === 'Delete'}
      />
    </>
  );
}
