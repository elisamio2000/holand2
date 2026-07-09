// ============================================
// CaseTrackingView — Case queue tracking with real API
// Uses GET /import/queue/position/{case_id}, POST /import/queue/cancel/{case_id}
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Title, Text, Badge, Loader, Button, ActionIcon } from 'rizzui';
import {
  PiMapPinLineDuotone,
  PiArrowClockwiseBold,
  PiArrowLeftBold,
  PiQueueBold,
  PiXCircleBold,
  PiCheckCircleBold,
  PiClockBold,
  PiSpinnerGapBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { gatewayClient } from '@/lib/api-client';
import { routes } from '@/config/routes';

/**
 * CaseTrackingView — Track case import progress and queue position.
 *
 * Fetches data from:
 * - GET /import/status/{case_id} — import status
 * - GET /import/queue/position/{case_id} — queue position
 * - POST /import/queue/cancel/{case_id} — cancel queued import
 *
 * Shows a timeline of the import process with live status.
 *
 * @param props.caseId - The unique identifier of the case to track
 * @requires gatewayClient
 * @version 0.21.0
 */
export default function CaseTrackingView({ caseId }: { caseId: string }) {
  const { t } = useTranslation();

  const [status, setStatus] = useState<Record<string, unknown> | null>(null);
  const [position, setPosition] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  /**
   * Fetch status and queue position.
   * @endpoint GET /import/status/{case_id}
   * @endpoint GET /import/queue/position/{case_id}
   */
  const fetchData = useCallback(async () => {
    console.info('[CaseTrackingView] Fetching tracking data:', { caseId });
    setLoading(true);
    try {
      const [statusRes, posRes] = await Promise.allSettled([
        gatewayClient.get(`/import/status/${caseId}`),
        gatewayClient.get(`/import/queue/position/${caseId}`),
      ]);

      if (statusRes.status === 'fulfilled') {
        console.info('[CaseTrackingView] Status loaded:', statusRes.value.data);
        setStatus(statusRes.value.data);
      }
      if (posRes.status === 'fulfilled') {
        console.info('[CaseTrackingView] Queue position loaded:', posRes.value.data);
        setPosition(posRes.value.data);
      }
    } catch (err: unknown) {
      console.error('[CaseTrackingView] Fetch failed:', err);
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Cancel queued import.
   * @endpoint POST /import/queue/cancel/{case_id}
   */
  const handleCancel = useCallback(async () => {
    if (!confirm(t('cases.tracking.cancelImport') + '?')) return;
    console.info('[CaseTrackingView] Cancelling import:', { caseId });
    setCancelling(true);
    try {
      await gatewayClient.post(`/import/queue/cancel/${caseId}`);
      console.info('[CaseTrackingView] Import cancelled:', { caseId });
      toast.success(t('cases.tracking.cancelImport') + ' ✓');
      fetchData();
    } catch (err: unknown) {
      console.error('[CaseTrackingView] Cancel failed:', err);
      toast.error(t('toast.failedCancelImport'));
    } finally {
      setCancelling(false);
    }
  }, [caseId, fetchData, t]);

  // Import steps for timeline
  const importSteps = [
    { key: 'review', label: t('cases.status.reviewing'), icon: <PiClockBold className="h-4 w-4" /> },
    { key: 'embedding', label: t('cases.status.embedding'), icon: <PiSpinnerGapBold className="h-4 w-4" /> },
    { key: 'storing', label: t('cases.status.storing'), icon: <PiSpinnerGapBold className="h-4 w-4" /> },
    { key: 'completed', label: t('cases.status.completed'), icon: <PiCheckCircleBold className="h-4 w-4" /> },
  ];

  const currentStatus = String(status?.status || status?.current_step || '').toLowerCase();
  const currentStepIdx = importSteps.findIndex((s) => s.key === currentStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={routes.cases.list}>
            <ActionIcon variant="outline">
              <PiArrowLeftBold className="h-4 w-4" />
            </ActionIcon>
          </Link>
          <PiMapPinLineDuotone className="h-7 w-7 text-primary" />
          <div>
            <Title as="h4" className="font-semibold">
              {t('cases.tracking.title')}
            </Title>
            <Text className="font-mono text-xs text-gray-400">{caseId}</Text>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip content={t('common.refresh')}>
            <ActionIcon variant="outline" onClick={fetchData}>
              <PiArrowClockwiseBold className="h-4 w-4" />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size="lg" />
        </div>
      ) : (
        <>
          {/* Queue Position */}
          {position && (
            <div className="flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30">
              <PiQueueBold className="h-5 w-5 text-blue-500" />
              <div>
                <Text className="text-sm font-medium text-blue-700 dark:text-blue-300">
                  {t('cases.tracking.position')}: #{String(position.position ?? position.queue_position ?? '—')}
                </Text>
              </div>
              <div className="ms-auto">
                <Button
                  variant="outline"
                  color="danger"
                  size="sm"
                  onClick={handleCancel}
                  isLoading={cancelling}
                  className="gap-1.5"
                >
                  <PiXCircleBold className="h-4 w-4" />
                  {t('cases.tracking.cancelImport')}
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
            <Title as="h5" className="mb-6 font-semibold">
              {t('cases.detail.timeline')}
            </Title>
            <div className="space-y-0">
              {importSteps.map((step, idx) => {
                const isCompleted = idx < currentStepIdx || currentStatus === 'completed';
                const isActive = idx === currentStepIdx && currentStatus !== 'completed';
                const isFailed = currentStatus === 'failed' && idx === currentStepIdx;

                return (
                  <div key={step.key} className="flex gap-4">
                    {/* Timeline line + dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors',
                          isCompleted
                            ? 'border-green-500 bg-green-500 text-white'
                            : isFailed
                              ? 'border-red-500 bg-red-500 text-white'
                              : isActive
                                ? 'border-primary bg-primary text-white'
                                : 'border-gray-300 bg-white text-gray-400 dark:border-gray-500 dark:bg-gray-100'
                        )}
                      >
                        {isCompleted ? (
                          <PiCheckCircleBold className="h-4 w-4" />
                        ) : (
                          step.icon
                        )}
                      </div>
                      {idx < importSteps.length - 1 && (
                        <div
                          className={cn(
                            'h-10 w-0.5',
                            isCompleted ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-300'
                          )}
                        />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pb-6 pt-1">
                      <Text
                        className={cn(
                          'font-medium',
                          isCompleted
                            ? 'text-green-600 dark:text-green-400'
                            : isActive
                              ? 'text-primary'
                              : isFailed
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-gray-400'
                        )}
                      >
                        {step.label}
                      </Text>
                      {isActive && (
                        <Badge variant="flat" color="primary" className="mt-1" size="sm">
                          {t('common.active')}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Raw Status Data */}
          {status && (
            <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
              <Title as="h5" className="mb-3 font-semibold">
                {t('common.details')}
              </Title>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {Object.entries(status).map(([key, value]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md border border-muted px-3 py-2"
                  >
                    <Text className="text-sm capitalize text-gray-500">
                      {key.replace(/_/g, ' ')}
                    </Text>
                    <Text className="text-sm font-medium">
                      {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '—')}
                    </Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
