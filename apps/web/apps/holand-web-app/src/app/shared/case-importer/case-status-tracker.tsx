// ============================================
// CaseStatusTracker — Step-by-step progress tracker for import phases
// Inspired by logistics/tracking timeline, adapted for import lifecycle
// ============================================

'use client';

import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import cn from '@core/utils/class-names';
import {
  PiClockDuotone,
  PiMagnifyingGlassDuotone,
  PiCubeDuotone,
  PiFloppyDiskDuotone,
  PiCheckCircleDuotone,
  PiXCircleDuotone,
} from 'react-icons/pi';
import type { CaseStatus } from '@/types/case-importer.types';

/**
 * Steps in the import lifecycle, ordered sequentially.
 */
const IMPORT_STEPS: {
  status: CaseStatus;
  label: string;
  icon: React.ReactNode;
}[] = [
  {
    status: 'pending',
    label: 'Pending',
    icon: <PiClockDuotone className="h-5 w-5" />,
  },
  {
    status: 'analyzing',
    label: 'Analyzing',
    icon: <PiMagnifyingGlassDuotone className="h-5 w-5" />,
  },
  {
    status: 'embedding',
    label: 'Embedding',
    icon: <PiCubeDuotone className="h-5 w-5" />,
  },
  {
    status: 'storing',
    label: 'Storing',
    icon: <PiFloppyDiskDuotone className="h-5 w-5" />,
  },
  {
    status: 'completed',
    label: 'Complete',
    icon: <PiCheckCircleDuotone className="h-5 w-5" />,
  },
];

/**
 * Map each status to its numeric step index for progress calculation.
 */
const STATUS_STEP_INDEX: Record<CaseStatus, number> = {
  pending: 0,
  analyzing: 1,
  embedding: 2,
  storing: 3,
  security: 3,
  paused: 2,
  cancelled: -1,
  completed: 4,
  failed: -1,
};

/**
 * CaseStatusTracker — Horizontal step tracker for case import progress.
 *
 * Displays 5 steps: Pending → Analyzing → Embedding → Storing → Complete.
 * Current step is highlighted, completed steps show checkmarks.
 * Failed status shows an error indicator on the failed step.
 *
 * @requires rizzui Text, Title
 * @requires case-importer.types CaseStatus
 *
 * @example
 * ```tsx
 * <CaseStatusTracker status="analyzing" progress={0.45} />
 * ```
 */
export default function CaseStatusTracker({
  status,
  progress = 0,
  className,
}: {
  /** Current case status */
  status: CaseStatus;
  /** Progress fraction (0.0 to 1.0) */
  progress?: number;
  /** Additional CSS classes */
  className?: string;
}) {
  const { t } = useTranslation();
  const currentStepIndex = STATUS_STEP_INDEX[status];
  const isFailed = status === 'failed';

  return (
    <div className={cn('rounded-lg border border-muted p-4 sm:p-6', className)}>
      <div className="mb-4 flex items-center justify-between">
        <Title as="h5" className="text-sm font-semibold text-gray-900 dark:text-gray-700">
          {t('cases.detail.importProgress', 'Import Progress')}
        </Title>
        {!isFailed && (
          <Text className="text-sm font-medium text-primary">
            {Math.round(progress * 100)}%
          </Text>
        )}
        {isFailed && (
          <Text className="text-sm font-medium text-red">
            {t('cases.status.failed', 'Failed')}
          </Text>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-200">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isFailed ? 'bg-red' : 'bg-primary'
          )}
          style={{ width: `${Math.min(progress * 100, 100)}%` }}
        />
      </div>

      {/* Steps */}
      <div className="flex items-center justify-between">
        {IMPORT_STEPS.map((step, index) => {
          const isCompleted = currentStepIndex > index;
          const isCurrent = currentStepIndex === index;
          const isPending = currentStepIndex < index;

          return (
            <div key={step.status} className="flex flex-col items-center gap-2">
              {/* Step circle */}
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-colors',
                  isCompleted && 'border-primary bg-primary text-white',
                  isCurrent && !isFailed && 'border-primary bg-primary-lighter text-primary animate-pulse',
                  isCurrent && isFailed && 'border-red bg-red-lighter text-red',
                  isPending && 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-300 dark:bg-gray-100 dark:text-gray-400'
                )}
              >
                {isCompleted ? (
                  <PiCheckCircleDuotone className="h-5 w-5" />
                ) : isCurrent && isFailed ? (
                  <PiXCircleDuotone className="h-5 w-5" />
                ) : (
                  step.icon
                )}
              </div>

              {/* Step label */}
              <Text
                className={cn(
                  'text-xs font-medium',
                  isCompleted && 'text-primary',
                  isCurrent && !isFailed && 'text-primary font-semibold',
                  isCurrent && isFailed && 'text-red font-semibold',
                  isPending && 'text-gray-400'
                )}
              >
                {t(`cases.status.${step.status}`, step.label)}
              </Text>
            </div>
          );
        })}
      </div>
    </div>
  );
}
