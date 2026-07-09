'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Loader, Progressbar, Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  formatVramMb,
  normalizedGpuDeviceView,
  adminRemoteNodesService,
  type NodeGpuStreamSnapshot,
} from '@/services/admin-remote-nodes.service';
import {
  useNodeGpuStream,
  type UseNodeGpuStreamReturn,
} from '../hooks/use-node-gpu-stream';
import NodeGpuHistoryChart from './node-gpu-history-chart';

interface NodeGpuPanelProps {
  nodeId: string;
  stream?: UseNodeGpuStreamReturn;
}

export default function NodeGpuPanel({ nodeId, stream: externalStream }: NodeGpuPanelProps) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'snapshot' | 'history'>('snapshot');
  const internalStream = useNodeGpuStream(nodeId, {
    enabled: tab === 'snapshot' && !externalStream,
  });
  const { snapshot, connected, reconnecting, polling, error, refreshOnce } =
    externalStream ?? internalStream;
  const [history, setHistory] = useState<Record<string, unknown>[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    if (tab !== 'history') return;
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const rows = await adminRemoteNodesService.getNodeGpuHistory(nodeId);
        if (!cancelled) setHistory(rows);
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [nodeId, tab]);

  const devices = useMemo(
    () => (snapshot?.devices ?? []).map((dev, i) => normalizedGpuDeviceView(dev, i)),
    [snapshot?.devices]
  );

  const clusterSummary = useMemo(() => {
    if (!devices.length) return null;
    const used = devices.reduce((s, d) => s + (d.memoryUsedMb ?? 0), 0);
    const total = devices.reduce((s, d) => s + (d.memoryTotalMb ?? 0), 0);
    const utilVals = devices.map((d) => d.utilizationPct).filter((v) => v != null) as number[];
    const maxUtil = utilVals.length ? Math.max(...utilVals) : undefined;
    const snap = snapshot as NodeGpuStreamSnapshot | null;
    return {
      used,
      total,
      maxUtil,
      driver: snap?.driver_version ?? devices[0]?.driverVersion,
      cuda: snap?.cuda_version ?? (snap?.summary?.cuda_version as string | undefined),
      deviceCount: devices.length,
    };
  }, [devices, snapshot]);

  const showClusterSummary = devices.length > 1;

  const renderDeviceCard = (dev: ReturnType<typeof normalizedGpuDeviceView>, i: number) => (
    <div key={i} className="rounded border border-muted px-3 py-2 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          {showClusterSummary && dev.index != null && (
            <Badge variant="outline" size="sm" className="shrink-0">
              #{dev.index}
            </Badge>
          )}
          <Text className="truncate font-medium">{dev.name}</Text>
        </div>
        {dev.memoryUsedMb != null && dev.memoryTotalMb != null && (
          <Badge variant="flat" size="sm" className="shrink-0">
            {formatVramMb(dev.memoryUsedMb)} / {formatVramMb(dev.memoryTotalMb)}
          </Badge>
        )}
      </div>
      {dev.memoryFreeMb != null && dev.memoryFreeMb > 0 && (
        <Text className="mt-0.5 text-gray-500">
          {t('adminNodes.gpuMemoryFree', 'Free VRAM')}: {formatVramMb(dev.memoryFreeMb)}
        </Text>
      )}
      {dev.memoryTotalMb != null && dev.memoryTotalMb > 0 && dev.memoryUsedMb != null && (
        <Progressbar
          value={Math.min(100, Math.round((dev.memoryUsedMb / dev.memoryTotalMb) * 100))}
          className="mt-2 h-1.5"
        />
      )}
      <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
        {dev.utilizationPct != null && (
          <span className="text-gray-500">
            {t('adminNodes.gpuUtilization', 'Utilization')}: {Math.round(dev.utilizationPct)}%
          </span>
        )}
        {dev.temperatureC != null && dev.temperatureC > 0 && (
          <span className="text-gray-500">
            {t('adminNodes.gpuTemp', 'Temperature')}: {Math.round(dev.temperatureC)}°C
          </span>
        )}
        {dev.powerW != null && dev.powerW > 0 && (
          <span className="text-gray-500">
            {t('adminNodes.gpuPower', 'Power')}: {dev.powerW.toFixed(1)} W
            {dev.powerLimitW ? ` / ${dev.powerLimitW.toFixed(0)} W` : ''}
          </span>
        )}
        {dev.fanSpeedPct != null && dev.fanSpeedPct > 0 && (
          <span className="text-gray-500">
            {t('adminNodes.gpuFan', 'Fan')}: {Math.round(dev.fanSpeedPct)}%
          </span>
        )}
        {dev.clockMhz != null && dev.clockMhz > 0 && (
          <span className="text-gray-500">
            {t('adminNodes.gpuClock', 'Clock')}: {Math.round(dev.clockMhz)} MHz
          </span>
        )}
        {dev.driverVersion && (!showClusterSummary || !clusterSummary?.driver) && (
          <span className="text-gray-500">
            {t('adminNodes.gpuDriver', 'Driver')}: {dev.driverVersion}
          </span>
        )}
        {!showClusterSummary && clusterSummary?.cuda && (
          <span className="text-gray-500">
            {t('adminNodes.gpuCuda', 'CUDA')}: {clusterSummary.cuda}
          </span>
        )}
      </div>
    </div>
  );

  const liveLabel = connected
    ? t('adminNodes.gpuLive', 'Live')
    : reconnecting
      ? t('adminNodes.gpuReconnecting', 'Reconnecting…')
      : polling
        ? t('adminNodes.gpuPolling', 'Polling (REST)')
        : t('adminNodes.gpuDisconnected', 'Disconnected');

  const liveColor = connected ? 'success' : reconnecting ? 'warning' : polling ? 'info' : 'secondary';

  const showError = error && !snapshot;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={tab === 'snapshot' ? 'solid' : 'outline'}
            onClick={() => setTab('snapshot')}
          >
            {t('adminNodes.gpuSnapshot', 'Snapshot')}
          </Button>
          <Button
            size="sm"
            variant={tab === 'history' ? 'solid' : 'outline'}
            onClick={() => setTab('history')}
          >
            {t('adminNodes.gpuHistory', 'History')}
          </Button>
        </div>
        {tab === 'snapshot' && (
          <div className="flex items-center gap-2">
            <Badge size="sm" variant="flat" color={liveColor}>
              {liveLabel}
            </Badge>
            <Button size="sm" variant="text" onClick={() => void refreshOnce()}>
              {t('common.refresh', 'Refresh')}
            </Button>
          </div>
        )}
      </div>

      {tab === 'snapshot' ? (
        !snapshot && !showError ? (
          <div className="flex justify-center py-4">
            <Loader size="sm" />
          </div>
        ) : devices.length === 0 ? (
          <Text className="text-sm text-gray-400">
            {t('adminNodes.gpuUnavailable', 'GPU snapshot unavailable')}
          </Text>
        ) : (
          <div className="space-y-3">
            {showClusterSummary && clusterSummary && clusterSummary.total > 0 && (
              <div className="rounded border border-dashed border-muted px-3 py-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Text className="font-medium">
                    {t('adminNodes.gpuClusterSummary', '{{count}} GPU(s) total', {
                      count: clusterSummary.deviceCount,
                    })}
                  </Text>
                  <Badge variant="flat" size="sm">
                    {formatVramMb(clusterSummary.used)} / {formatVramMb(clusterSummary.total)}
                  </Badge>
                </div>
                <Progressbar
                  value={Math.min(
                    100,
                    Math.round((clusterSummary.used / clusterSummary.total) * 100)
                  )}
                  className="mt-2 h-1.5"
                />
                <div className="mt-1 flex flex-wrap gap-3 text-gray-500">
                  {clusterSummary.maxUtil != null && (
                    <span>
                      {t('adminNodes.gpuUtilization', 'Utilization')}:{' '}
                      {Math.round(clusterSummary.maxUtil)}%
                    </span>
                  )}
                  {clusterSummary.driver && (
                    <span>
                      {t('adminNodes.gpuDriver', 'Driver')}: {clusterSummary.driver}
                    </span>
                  )}
                  {clusterSummary.cuda && (
                    <span>
                      {t('adminNodes.gpuCuda', 'CUDA')}: {clusterSummary.cuda}
                    </span>
                  )}
                </div>
              </div>
            )}
            {devices.map((dev, i) => renderDeviceCard(dev, i))}
            {showError && (
              <Text className="text-xs text-amber-600">
                {t(
                  'adminNodes.gpuWsUnavailable',
                  'Live stream unavailable — showing last snapshot from REST.'
                )}
              </Text>
            )}
          </div>
        )
      ) : historyLoading ? (
        <div className="flex justify-center py-4">
          <Loader size="sm" />
        </div>
      ) : history.length === 0 ? (
        <Text className="text-xs text-gray-400">{t('adminNodes.noGpuHistory', 'No history')}</Text>
      ) : (
        <NodeGpuHistoryChart history={history} liveSnapshot={snapshot} />
      )}
    </div>
  );
}
