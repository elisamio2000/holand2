// ============================================
// GpuDashboardView — GPU monitoring with real API
// Uses GET /gpu/status, GET /gpu/models, POST /gpu/evict/*
// ============================================
'use client';

import { Tooltip } from '@/components/tooltip';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Title, Text, Badge, Loader, Button, ActionIcon, Empty } from 'rizzui';
import {
  PiCpuDuotone,
  PiArrowClockwiseBold,
  PiTrashBold,
  PiEjectBold,
  PiClockBold,
  PiMemoryBold,
  PiChartBarBold,
  PiLightningBold,
  PiWarningCircleBold,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import MetricCard from '@core/components/cards/metric-card';
import { useTranslation } from 'react-i18next';
import Link from 'next/link';
import { gpuAdminService, type GpuLoadedModel, type GpuStatus } from '@/services/gpu-admin.service';
import { routes } from '@/config/routes';

// ==========================================
// Types — re-exported from service
// ==========================================

type LoadedModel = GpuLoadedModel;

/**
 * GpuDashboardView — GPU resource monitoring and management.
 *
 * Fetches data from:
 * - GET /gpu/status — full GPU status (VRAM, models, queue, perf)
 * - GET /gpu/models — loaded models list
 * - POST /gpu/evict/{tool_id} — evict a single model
 * - POST /gpu/evict-all — evict all models
 * - POST /gpu/evict-idle — evict idle models
 *
 * Shows:
 * - VRAM usage cards and progress bar
 * - Loaded models table with evict actions
 * - Queue status
 * - Performance metrics
 *
 * @requires gatewayClient
 * @version 0.21.0
 */
export default function GpuDashboardView() {
  const { t } = useTranslation();

  const [gpuStatus, setGpuStatus] = useState<GpuStatus | null>(null);
  const [models, setModels] = useState<LoadedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [evicting, setEvicting] = useState<string | null>(null);

  // ==========================================
  // Data Fetching
  // ==========================================

  /**
   * Fetch GPU status and models in parallel.
   * @endpoint GET /gpu/status
   * @endpoint GET /gpu/models
   */
  const fetchData = useCallback(async () => {
    console.info('[GpuDashboardView] Fetching GPU status and models...');
    setLoading(true);
    setError(null);
    try {
      const [status, list] = await Promise.all([
        gpuAdminService.fetchStatus(),
        gpuAdminService.fetchModels(),
      ]);

      if (status) {
        setGpuStatus(status);
      } else {
        setError(t('errors.loadGpuStatus'));
      }

      const modelsList =
        list.length > 0 ? list : (status?.loaded_models as LoadedModel[]) ?? [];
      setModels(modelsList);
    } catch (err: unknown) {
      console.error('[GpuDashboardView] Unexpected error:', err);
      setError(t('errors.loadData'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
    const id = window.setInterval(fetchData, 30_000);
    return () => window.clearInterval(id);
  }, [fetchData]);

  // ==========================================
  // Actions
  // ==========================================

  /**
   * Evict a single model from GPU.
   * @endpoint POST /gpu/evict/{tool_id}
   */
  const handleEvict = useCallback(
    async (toolId: string) => {
      if (!confirm(t('gpu.actions.evictConfirm'))) return;
      console.info('[GpuDashboardView] Evicting model:', { toolId });
      setEvicting(toolId);
      try {
        await gpuAdminService.evictModel(toolId);
        console.info('[GpuDashboardView] Model evicted:', { toolId });
        toast.success(t('gpu.actions.evict') + ' ✓');
        fetchData();
      } catch (err: unknown) {
        console.error('[GpuDashboardView] Evict failed:', { toolId, err });
        toast.error(t('errors.evictModel'));
      } finally {
        setEvicting(null);
      }
    },
    [fetchData, t]
  );

  /**
   * Evict all models from GPU.
   * @endpoint POST /gpu/evict-all
   */
  const handleEvictAll = useCallback(async () => {
    if (!confirm(t('gpu.actions.evictAllConfirm'))) return;
    console.info('[GpuDashboardView] Evicting all models...');
    try {
      await gpuAdminService.evictAll();
      console.info('[GpuDashboardView] All models evicted');
      toast.success(t('gpu.actions.evictAll') + ' ✓');
      fetchData();
    } catch (err: unknown) {
      console.error('[GpuDashboardView] Evict all failed:', err);
      toast.error(t('errors.evictAllModels'));
    }
  }, [fetchData, t]);

  /**
   * Evict idle models (>5 min unused).
   * @endpoint POST /gpu/evict-idle
   */
  const handleEvictIdle = useCallback(async () => {
    if (!confirm(t('gpu.actions.evictIdleConfirm'))) return;
    console.info('[GpuDashboardView] Evicting idle models...');
    try {
      await gpuAdminService.evictIdle();
      console.info('[GpuDashboardView] Idle models evicted');
      toast.success(t('gpu.actions.evictIdle') + ' ✓');
      fetchData();
    } catch (err: unknown) {
      console.error('[GpuDashboardView] Evict idle failed:', err);
      toast.error(t('errors.evictIdleModels'));
    }
  }, [fetchData, t]);

  // ==========================================
  // Computed Values
  // ==========================================

  /** Format bytes to MB/GB string. */
  const formatVram = (bytes?: number): string => {
    if (!bytes) return '—';
    if (bytes >= 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  };

  const vramTotal = gpuStatus?.vram_total || 0;
  const vramAllocated = gpuStatus?.vram_allocated || 0;
  const vramFree = gpuStatus?.vram_free || 0;
  const vramPercent = vramTotal > 0 ? Math.round((vramAllocated / vramTotal) * 100) : 0;

  const queue = gpuStatus?.queue as Record<string, unknown> | undefined;
  const perf = gpuStatus?.performance as Record<string, unknown> | undefined;

  /** Format time ago string. */
  const formatTimeAgo = (dateStr?: string): string => {
    if (!dateStr) return '—';
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) return t('time.justNow');
      if (minutes < 60) return t('time.minutesAgo', { count: minutes });
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return t('time.hoursAgo', { count: hours });
      return t('time.daysAgo', { count: Math.floor(hours / 24) });
    } catch {
      return dateStr;
    }
  };

  // ==========================================
  // Render
  // ==========================================

  if (loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-12 text-center dark:border-red-800 dark:bg-red-950/30">
        <PiWarningCircleBold className="mx-auto h-12 w-12 text-red-500" />
        <Title as="h5" className="mt-3 text-red-600 dark:text-red-400">
          {error}
        </Title>
        <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">
          {t('common.refresh')}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
        <Text>
          {t('gpu.disclaimerToolRunner', 'This page shows tool-runner VRAM cache on the gateway — not inference GPU on remote nodes.')}{' '}
          <Link href={routes.admin.nodes} className="font-semibold underline">
            {t('gpu.linkNodes', 'GPU Nodes & Deploy')}
          </Link>
          {' · '}
          <Link href={routes.admin.pipeline} className="font-semibold underline">
            {t('gpu.linkPipeline', 'Pipeline Admin')}
          </Link>
        </Text>
      </div>
      {/* VRAM Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title={t('gpu.memory.total')}
          metric={formatVram(vramTotal)}
          icon={<PiMemoryBold className="h-6 w-6 text-primary" />}
          iconClassName="bg-primary/10"
        />
        <MetricCard
          title={t('gpu.memory.used')}
          metric={formatVram(vramAllocated)}
          icon={<PiChartBarBold className="h-6 w-6 text-amber-500" />}
          iconClassName="bg-amber-100 dark:bg-amber-900/30"
        />
        <MetricCard
          title={t('gpu.memory.free')}
          metric={formatVram(vramFree)}
          icon={<PiCpuDuotone className="h-6 w-6 text-green-500" />}
          iconClassName="bg-green-100 dark:bg-green-900/30"
        />
        <MetricCard
          title={t('gpu.models.title')}
          metric={models.length}
          icon={<PiLightningBold className="h-6 w-6 text-purple-500" />}
          iconClassName="bg-purple-100 dark:bg-purple-900/30"
        />
      </div>

      {/* VRAM Usage Bar */}
      <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
        <div className="mb-3 flex items-center justify-between">
          <Text className="text-sm font-medium">{t('gpu.status')}</Text>
          <Text className="text-sm font-semibold">{vramPercent}%</Text>
        </div>
        <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-300">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              vramPercent > 90
                ? 'bg-red-500'
                : vramPercent > 70
                  ? 'bg-orange-500'
                  : vramPercent > 50
                    ? 'bg-amber-500'
                    : 'bg-green-500'
            )}
            style={{ width: `${Math.min(vramPercent, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <Text>{formatVram(vramAllocated)} {t('gpu.memory.used').toLowerCase()}</Text>
          <Text>{formatVram(vramTotal)} {t('gpu.memory.total').toLowerCase()}</Text>
        </div>
      </div>

      {/* Queue & Performance */}
      {(queue || perf) && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {queue && (
            <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
              <Title as="h6" className="mb-3 font-semibold">
                {t('gpu.queue.title')}
              </Title>
              <div className="space-y-2">
                {Object.entries(queue).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Text className="text-sm capitalize text-gray-500">
                      {key.replace(/_/g, ' ')}
                    </Text>
                    <Badge variant="flat" size="sm">
                      {String(value)}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {perf && (
            <div className="rounded-lg border border-muted bg-gray-0 p-5 dark:bg-gray-50">
              <Title as="h6" className="mb-3 font-semibold">
                {t('gpu.performance.title')}
              </Title>
              <div className="space-y-2">
                {typeof perf.avg_inference_ms === 'number' && (
                  <div className="flex items-center justify-between">
                    <Text className="text-sm text-gray-500">
                      {t('gpu.performance.avgInference')}
                    </Text>
                    <Badge variant="flat" color="info" size="sm">
                      {perf.avg_inference_ms.toFixed(1)}ms
                    </Badge>
                  </div>
                )}
                {typeof perf.utilization === 'number' && (
                  <div className="flex items-center justify-between">
                    <Text className="text-sm text-gray-500">
                      {t('gpu.performance.utilization')}
                    </Text>
                    <Badge variant="flat" color="warning" size="sm">
                      {(perf.utilization * 100).toFixed(0)}%
                    </Badge>
                  </div>
                )}
                {Object.entries(perf)
                  .filter(([k]) => !['avg_inference_ms', 'utilization', 'throughput'].includes(k))
                  .map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between">
                      <Text className="text-sm capitalize text-gray-500">
                        {key.replace(/_/g, ' ')}
                      </Text>
                      <Badge variant="flat" size="sm">
                        {String(value)}
                      </Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loaded Models */}
      <div className="rounded-lg border border-muted bg-gray-0 dark:bg-gray-50">
        <div className="flex items-center justify-between border-b border-muted px-5 py-4">
          <Title as="h5" className="flex items-center gap-2 font-semibold">
            <PiLightningBold className="h-5 w-5 text-primary" />
            {t('gpu.models.title')} ({models.length})
          </Title>
          <div className="flex items-center gap-2">
            <Tooltip content={t('common.refresh')}>
              <ActionIcon variant="outline" size="sm" onClick={fetchData}>
                <PiArrowClockwiseBold className="h-4 w-4" />
              </ActionIcon>
            </Tooltip>
            {models.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEvictIdle}
                  className="gap-1 text-xs"
                >
                  <PiClockBold className="h-3.5 w-3.5" />
                  {t('gpu.actions.evictIdle')}
                </Button>
                <Button
                  variant="outline"
                  color="danger"
                  size="sm"
                  onClick={handleEvictAll}
                  className="gap-1 text-xs"
                >
                  <PiEjectBold className="h-3.5 w-3.5" />
                  {t('gpu.actions.evictAll')}
                </Button>
              </>
            )}
          </div>
        </div>

        {models.length === 0 ? (
          <div className="p-12 text-center">
            <PiCpuDuotone className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-500" />
            <Text className="mt-3 text-gray-500">{t('gpu.models.noModels')}</Text>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-100">
                  <th className="px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400">
                    {t('gpu.models.modelName')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 sm:table-cell">
                    {t('gpu.models.vramUsage')}
                  </th>
                  <th className="hidden px-4 py-3 text-start font-medium text-gray-600 dark:text-gray-400 md:table-cell">
                    {t('gpu.models.lastUsed')}
                  </th>
                  <th className="px-4 py-3 text-end font-medium text-gray-600 dark:text-gray-400">
                    {t('common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {models.map((model) => {
                  const id = model.tool_id || model.model_name || model.name || '';
                  return (
                    <tr
                      key={id}
                      className="transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-100/30"
                    >
                      <td className="px-4 py-3">
                        <Text className="font-medium">
                          {model.model_name || model.name || model.tool_id}
                        </Text>
                        {model.tool_id && (
                          <Text className="font-mono text-xs text-gray-400">
                            {model.tool_id}
                          </Text>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge variant="flat" color="warning" size="sm">
                          {formatVram(model.vram_usage || model.vram_mb)}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 md:table-cell">
                        <Text className="text-xs text-gray-500">
                          {formatTimeAgo(model.last_used || model.loaded_at)}
                        </Text>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <Tooltip content={t('gpu.actions.evict')}>
                            <ActionIcon
                              variant="outline"
                              color="danger"
                              size="sm"
                              onClick={() => handleEvict(id)}
                              disabled={evicting === id}
                            >
                              {evicting === id ? (
                                <Loader size="sm" />
                              ) : (
                                <PiTrashBold className="h-4 w-4" />
                              )}
                            </ActionIcon>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
