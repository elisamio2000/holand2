// ============================================
// Case View — Statistics panel (hybrid live + mock)
// ============================================

'use client';

import { useMemo } from 'react';
import { Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import CaseViewDataBanner from '@/app/shared/cases/panels/case-view-data-banner';
import {
  buildActivityHeatmapFromDetail,
  heatmapHasActivity,
} from '@/utils/case-view-heatmap';
import type { CaseViewDataContext } from '@/hooks/use-case-view-data';

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#6366f1'];

export default function CaseViewStatisticsPanel({ data }: { data: CaseViewDataContext }) {
  const { t } = useTranslation();
  const { detail } = data;

  const fileTypeData = useMemo(() => {
    const files = Array.isArray(detail?.files) ? detail!.files : [];
    const counts = new Map<string, number>();
    for (const f of files) {
      const key = (f.kind || f.media_type || 'other').toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [detail]);

  const toolCoverageData = useMemo(() => {
    const files = Array.isArray(detail?.files) ? detail!.files : [];
    const counts = new Map<string, number>();
    for (const f of files) {
      if (!Array.isArray(f.tools)) continue;
      for (const tr of f.tools) {
        const id = tr.tool_id || 'unknown';
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .slice(0, 8);
  }, [detail]);

  const successRate = useMemo(() => {
    if (!detail || detail.files_total === 0) return 0;
    return Math.round((detail.files_done / detail.files_total) * 100);
  }, [detail]);

  const heatmapCells = useMemo(
    () => buildActivityHeatmapFromDetail(detail),
    [detail]
  );

  const heatmapData = useMemo(() => {
    const byHour = new Map<number, number>();
    for (const c of heatmapCells) {
      byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.value);
    }
    return Array.from({ length: 24 }, (_, hour) => ({
      hour,
      count: byHour.get(hour) ?? 0,
    }));
  }, [heatmapCells]);

  const heatmapDerived = heatmapHasActivity(heatmapCells);

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-muted p-4">
          <Title as="h6" className="mb-4 text-sm font-semibold">
            {t('cases.view.statistics.fileTypes')}
          </Title>
          {fileTypeData.length === 0 ? (
            <Text className="text-gray-500">{t('common.noData')}</Text>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={fileTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                  {fileTypeData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="rounded-lg border border-muted p-4">
          <Title as="h6" className="mb-4 text-sm font-semibold">
            {t('cases.view.statistics.toolCoverage')}
          </Title>
          {toolCoverageData.length === 0 ? (
            <Text className="text-gray-500">{t('common.noData')}</Text>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={toolCoverageData} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#6366f1" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-muted p-4">
        <Title as="h6" className="mb-2 text-sm font-semibold">
          {t('cases.view.statistics.successRate')}
        </Title>
        <Text className="text-3xl font-bold text-primary">{successRate}%</Text>
        <Text className="mt-1 text-sm text-gray-500">
          {detail?.files_done ?? 0} / {detail?.files_total ?? 0}
        </Text>
      </div>

      <div className="rounded-lg border border-muted p-4">
        {heatmapDerived ? (
          <CaseViewDataBanner variant="derived" />
        ) : null}
        <Title as="h6" className="mb-4 text-sm font-semibold">
          {t('cases.view.statistics.timeHeatmap')}
        </Title>
        {!heatmapDerived ? (
          <Text className="text-gray-500">{t('cases.view.statistics.heatmapNoActivity')}</Text>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={heatmapData}>
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={4} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
