// ============================================
// StorageDashboardView — Storage usage and file stats
// Uses real API: GET /storage/storage/quota, storage artifacts
// ============================================
'use client';

import { useCallback, useEffect, useState } from 'react';
import { Title, Text, Badge, Loader, Button } from 'rizzui';
import {
  PiHardDrivesDuotone,
  PiArrowClockwiseBold,
  PiFileDuotone,
  PiImageDuotone,
  PiVideoCameraDuotone,
  PiFileAudioDuotone,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import cn from '@core/utils/class-names';
import { useTranslation } from 'react-i18next';
import { chatService } from '@/services/chat.service';

/** Storage quota shape from the backend */
interface StorageQuotaInfo {
  used_bytes?: number;
  total_bytes?: number;
  used_formatted?: string;
  total_formatted?: string;
  percentage?: number;
  file_count?: number;
  [key: string]: any;
}

/**
 * StorageDashboardView — Storage usage overview using real backend data.
 *
 * Calls:
 * - chatService.getStorageQuota() → GET /storage/storage/quota
 *
 * Shows storage usage bars, file counts by type, and quota info.
 *
 * @requires chatService.getStorageQuota
 * @version 0.20.0
 */
export default function StorageDashboardView() {
  const { t } = useTranslation();
  const [quota, setQuota] = useState<StorageQuotaInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    console.info('[StorageDashboardView] Fetching storage quota...');
    setLoading(true);
    setError(null);
    try {
      const data = await chatService.getStorageQuota();
      console.info('[StorageDashboardView] Storage quota loaded:', data);
      setQuota(data as StorageQuotaInfo);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch storage data';
      console.error('[StorageDashboardView] Failed:', err);
      setError(msg);
      toast.error(t('storageDashboard.errorFetch'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /**
   * Format bytes to human-readable string.
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const usedBytes = quota?.used_bytes || 0;
  const totalBytes = quota?.total_bytes || 1;
  const usagePercent = quota?.percentage || Math.round((usedBytes / totalBytes) * 100);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10">
            <PiHardDrivesDuotone className="h-8 w-8 text-primary" />
          </div>
          <div>
            <Title as="h4" className="text-lg font-semibold">
              {t('storage.title')}
            </Title>
            <Text className="text-sm text-gray-500">
              {t('storageDashboard.monitoring')}
            </Text>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <PiArrowClockwiseBold className="h-4 w-4" />
          {t('common.refresh')}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader size="lg" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-dashed border-red-300 bg-red-50 p-8 text-center dark:border-red-800 dark:bg-red-950/30">
          <Text className="text-red-600 dark:text-red-400">{error}</Text>
          <Button variant="outline" size="sm" onClick={fetchData} className="mt-4">
            {t('storageDashboard.retry')}
          </Button>
        </div>
      ) : (
        <>
          {/* Usage Card */}
          <div className="rounded-lg border border-muted bg-gray-0 p-6 dark:bg-gray-50">
            <div className="mb-4 flex items-end justify-between">
              <div>
                <Text className="text-sm text-gray-500">{t('storageDashboard.usedSpace')}</Text>
                <Title as="h3" className="mt-1 text-3xl font-bold">
                  {quota?.used_formatted || formatBytes(usedBytes)}
                </Title>
              </div>
              <div className="text-end">
                <Text className="text-sm text-gray-500">{t('storageDashboard.totalSpace')}</Text>
                <Text className="text-lg font-semibold">
                  {quota?.total_formatted || formatBytes(totalBytes)}
                </Text>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-300">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  usagePercent > 90
                    ? 'bg-red-500'
                    : usagePercent > 70
                      ? 'bg-orange-500'
                      : 'bg-primary'
                )}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            <Text className="mt-2 text-sm text-gray-500">
              {usagePercent}{t('storageDashboard.percentUsed')}
            </Text>
          </div>

          {/* File Count */}
          {quota?.file_count !== undefined && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <StatCard
                icon={<PiFileDuotone className="h-6 w-6 text-blue-500" />}
                label={t('storageDashboard.fileCount')}
                value={quota.file_count.toLocaleString()}
              />
              <StatCard
                icon={<PiImageDuotone className="h-6 w-6 text-green-500" />}
                label={t('storageDashboard.images')}
                value="—"
              />
              <StatCard
                icon={<PiVideoCameraDuotone className="h-6 w-6 text-purple-500" />}
                label={t('storageDashboard.videos')}
                value="—"
              />
              <StatCard
                icon={<PiFileAudioDuotone className="h-6 w-6 text-orange-500" />}
                label={t('storageDashboard.audio')}
                value="—"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Small stat card component */
function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-muted bg-gray-0 p-4 dark:bg-gray-50">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-200">
        {icon}
      </div>
      <div>
        <Text className="text-xs text-gray-500">{label}</Text>
        <Title as="h6" className="text-lg font-bold">
          {value}
        </Title>
      </div>
    </div>
  );
}
