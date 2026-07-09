'use client';

import { useMemo } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Text } from 'rizzui';
import { useTranslation } from 'react-i18next';
import type { NodeGpuStreamSnapshot } from '@/services/admin-remote-nodes.service';
import { formatVramMb } from '@/services/admin-remote-nodes.service';

type GpuHistoryPoint = {
  ts: string;
  tsLabel: string;
  memory_used_mb: number;
  utilization_pct?: number;
  [deviceKey: string]: string | number | undefined;
};

function parsePointMs(point: GpuHistoryPoint): number | null {
  const raw = point.ts;
  if (!raw || String(raw).startsWith('#')) return null;
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && asNum > 0) {
    if (asNum > 1e12) return asNum;
    if (asNum > 1e9) return asNum * 1000;
  }
  const d = new Date(String(raw));
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

/** Human-readable window label for the chart caption (not per-tick timestamps). */
export function formatGpuHistoryWindowLabel(
  series: GpuHistoryPoint[],
  t: (key: string, options?: Record<string, unknown>) => string
): string {
  const times = series.map(parsePointMs).filter((ms): ms is number => ms != null);
  let spanSec = 0;
  if (times.length >= 2) {
    spanSec = (Math.max(...times) - Math.min(...times)) / 1000;
  } else if (series.length > 1) {
    spanSec = series.length * 10;
  }
  if (spanSec <= 0) {
    return t('adminNodes.gpuHistoryRecent', 'Recent GPU activity');
  }
  if (spanSec < 90) {
    return t('adminNodes.gpuHistoryWindow1m', 'Last ~1 minute');
  }
  if (spanSec < 360) {
    return t('adminNodes.gpuHistoryWindow5m', 'Last ~5 minutes');
  }
  if (spanSec < 900) {
    return t('adminNodes.gpuHistoryWindow15m', 'Last ~15 minutes');
  }
  const minutes = Math.max(1, Math.round(spanSec / 60));
  return t('adminNodes.gpuHistoryWindowMinutes', {
    count: minutes,
    defaultValue: `Last ~${minutes} minutes`,
  });
}

function formatTsLabel(raw: string | number): string {
  if (typeof raw === 'number' && raw > 1e9) {
    return new Date(raw * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  const text = String(raw ?? '');
  if (!text || text.startsWith('#')) return text;
  const asNum = Number(text);
  if (!Number.isNaN(asNum) && asNum > 1e9) {
    return new Date(asNum * 1000).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  }
  const d = new Date(text);
  if (Number.isNaN(d.getTime())) return text.slice(0, 16);
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function unwrapHistoryRow(raw: Record<string, unknown>): Record<string, unknown> {
  const snap = raw.snapshot;
  if (snap && typeof snap === 'object') {
    return { ...(snap as Record<string, unknown>), ts: raw.ts ?? (snap as Record<string, unknown>).ts };
  }
  return raw;
}

function readMemoryMb(row: Record<string, unknown>, deviceIndex?: number): number {
  if (deviceIndex != null && Array.isArray(row.devices)) {
    const dev = row.devices[deviceIndex] as Record<string, unknown> | undefined;
    if (dev) {
      const v = Number(dev.memory_used_mb ?? dev['memory.used']);
      if (v > 0) return v;
    }
  }
  const gpu = row.gpu as Record<string, unknown> | undefined;
  const summary = row.summary as Record<string, unknown> | undefined;
  return (
    Number(row.memory_used_mb) ||
    Number(summary?.used_vram_mb) ||
    Number(gpu?.memory_used_mb) ||
    0
  );
}

function readUtilization(row: Record<string, unknown>): number | undefined {
  const summary = row.summary as Record<string, unknown> | undefined;
  const gpu = row.gpu as Record<string, unknown> | undefined;
  const firstDev = Array.isArray(row.devices)
    ? (row.devices[0] as Record<string, unknown> | undefined)
    : undefined;
  const v = Number(
    row.utilization_pct ??
      row.gpu_utilization_pct ??
      summary?.utilization_pct ??
      gpu?.utilization_pct ??
      firstDev?.['utilization.gpu'] ??
      firstDev?.utilization_pct
  );
  return v > 0 ? v : undefined;
}

export function parseGpuHistory(rows: Record<string, unknown>[]): GpuHistoryPoint[] {
  const out: GpuHistoryPoint[] = [];

  for (const raw of rows) {
    const row = unwrapHistoryRow(raw);
    const tsRaw = row.timestamp ?? row.ts ?? row.recorded_at ?? row.time ?? '';
    const memory = readMemoryMb(row);
    const util = readUtilization(row);
    if (tsRaw === '' && !memory && util == null) continue;

    const ts = String(tsRaw || `#${out.length + 1}`);
    const point: GpuHistoryPoint = {
      ts,
      tsLabel: formatTsLabel(tsRaw || `#${out.length + 1}`),
      memory_used_mb: memory,
      utilization_pct: util,
    };

    if (Array.isArray(row.devices)) {
      row.devices.forEach((dev, idx) => {
        if (!dev || typeof dev !== 'object') return;
        const d = dev as Record<string, unknown>;
        const key = `gpu${idx}_mb`;
        const mb = Number(d.memory_used_mb ?? d['memory.used']);
        if (mb > 0) point[key] = mb;
      });
    }

    out.push(point);
  }

  return out;
}

interface NodeGpuHistoryChartProps {
  history: Record<string, unknown>[];
  liveSnapshot?: NodeGpuStreamSnapshot | null;
}

export default function NodeGpuHistoryChart({ history, liveSnapshot }: NodeGpuHistoryChartProps) {
  const { t } = useTranslation();
  const series = useMemo(() => {
    const base = parseGpuHistory(history);
    if (!liveSnapshot?.summary) return base;
    const used = Number(
      liveSnapshot.summary.used_vram_mb ?? liveSnapshot.summary.memory_used_mb
    );
    const util = Number(
      liveSnapshot.summary.utilization_pct ?? liveSnapshot.utilization_pct
    );
    if (!used && !util) return base;
    const ts = liveSnapshot.ts ?? new Date().toISOString();
    const livePoint: GpuHistoryPoint = {
      ts,
      tsLabel: formatTsLabel(ts),
      memory_used_mb: used,
      utilization_pct: util > 0 ? util : undefined,
    };
    const trimmed = base.length >= 120 ? base.slice(-119) : base;
    return [...trimmed, livePoint];
  }, [history, liveSnapshot]);

  const deviceSeriesKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const p of series) {
      Object.keys(p).forEach((k) => {
        if (k.startsWith('gpu') && k.endsWith('_mb')) keys.add(k);
      });
    }
    return Array.from(keys);
  }, [series]);

  const hasUtil = series.some((p) => (p.utilization_pct ?? 0) > 0);

  const memAxisWidth = useMemo(() => {
    let peak = 0;
    for (const p of series) {
      peak = Math.max(peak, Number(p.memory_used_mb) || 0);
      for (const key of deviceSeriesKeys) {
        peak = Math.max(peak, Number(p[key]) || 0);
      }
    }
    const sample = formatVramMb(peak || 1024);
    return Math.min(64, Math.max(44, sample.length * 7));
  }, [series, deviceSeriesKeys]);

  const windowLabel = useMemo(
    () => formatGpuHistoryWindowLabel(series, t),
    [series, t]
  );

  if (series.length === 0) {
    return (
      <Text className="text-xs text-gray-400">{t('adminNodes.noGpuHistory', 'No history')}</Text>
    );
  }

  const colors = ['var(--primary-default)', '#6366f1', '#14b8a6', '#f59e0b'];

  return (
    <div className="space-y-1">
      <Text className="text-[11px] text-gray-500">{windowLabel}</Text>
      <div className="h-48 w-full min-w-0 overflow-visible pl-1">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={series}
            margin={{ left: 4, right: hasUtil ? 40 : 8, top: 4, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="4 4" strokeOpacity={0.3} />
            <XAxis dataKey="tsLabel" hide />
            <YAxis
              yAxisId="mem"
              tick={{ fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              width={memAxisWidth}
              tickFormatter={(v) => formatVramMb(v)}
            />
            {hasUtil && (
              <YAxis
                yAxisId="util"
                orientation="right"
                domain={[0, 100]}
                tick={{ fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={36}
                tickFormatter={(v) => `${Math.round(v)}%`}
              />
            )}
            <Tooltip
              contentStyle={{ fontSize: 11 }}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as GpuHistoryPoint | undefined;
                if (!row?.tsLabel) return '';
                return row.tsLabel;
              }}
              formatter={(value: number, name: string) => {
                if (name === 'utilization_pct') {
                  return [`${Math.round(value)}%`, t('adminNodes.gpuUtilization', 'Utilization')];
                }
                return [`${value} MB`, name === 'memory_used_mb' ? 'VRAM' : name];
              }}
            />
            {deviceSeriesKeys.length > 0 ? (
              deviceSeriesKeys.map((key, i) => (
                <Area
                  key={key}
                  yAxisId="mem"
                  type="monotone"
                  dataKey={key}
                  stroke={colors[i % colors.length]}
                  fill={colors[i % colors.length]}
                  fillOpacity={0.12}
                  name={key}
                />
              ))
            ) : (
              <Area
                yAxisId="mem"
                type="monotone"
                dataKey="memory_used_mb"
                stroke="var(--primary-default)"
                fill="var(--primary-default)"
                fillOpacity={0.15}
                name="memory_used_mb"
              />
            )}
            {hasUtil && (
              <Line
                yAxisId="util"
                type="monotone"
                dataKey="utilization_pct"
                stroke="#ef4444"
                dot={false}
                strokeWidth={1.5}
                name="utilization_pct"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
