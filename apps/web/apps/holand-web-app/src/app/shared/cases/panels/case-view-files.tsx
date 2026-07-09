// ============================================
// Case View — Files panel (live)
// ============================================

'use client';

import { useMemo, useState } from 'react';
import { Badge, Input, Select, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { PiFilesBold, PiMagnifyingGlassBold } from 'react-icons/pi';
import type { CaseFile } from '@/types/case-importer.types';
import type { CaseViewDataContext } from '@/hooks/use-case-view-data';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatToolsSummary(f: CaseFile): string {
  if (!Array.isArray(f.tools) || f.tools.length === 0) return '—';
  return f.tools.map((tr) => `${tr.tool_id}${tr.ok ? '✓' : '✗'}`).join(', ');
}

export default function CaseViewFilesPanel({ data }: { data: CaseViewDataContext }) {
  const { t } = useTranslation();
  const { detail } = data;
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const files = useMemo(
    () => (Array.isArray(detail?.files) ? detail!.files : []),
    [detail]
  );

  const filtered = useMemo(() => {
    let result = [...files];
    if (statusFilter !== 'all') {
      result = result.filter((f) => (f.status || '').toLowerCase() === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (f) =>
          f.relative_path?.toLowerCase().includes(q) ||
          f.artifact_id?.toLowerCase().includes(q) ||
          f.kind?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [files, search, statusFilter]);

  if (!detail) return null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('common.search')}
          prefix={<PiMagnifyingGlassBold className="h-4 w-4 text-gray-400" />}
          className="max-w-xs"
        />
        <Select
          className="w-40"
          value={statusFilter}
          onChange={(v: string) => setStatusFilter(v)}
          options={[
            { label: t('common.all'), value: 'all' },
            { label: t('cases.status.completed'), value: 'completed' },
            { label: t('cases.status.failed'), value: 'failed' },
            { label: t('cases.status.pending'), value: 'pending' },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-lg border border-muted">
        <div className="flex items-center gap-2 border-b border-muted px-4 py-3">
          <PiFilesBold className="h-5 w-5 text-primary" />
          <Title as="h6" className="text-sm font-semibold">
            {t('cases.detail.files')} ({filtered.length})
          </Title>
        </div>
        {filtered.length === 0 ? (
          <Text className="p-8 text-center text-gray-500">{t('common.noData')}</Text>
        ) : (
          <div className="max-h-[min(60vh,640px)] overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-100">
                  <th className="px-4 py-2 text-start">{t('common.name')}</th>
                  <th className="hidden px-4 py-2 md:table-cell">{t('common.type')}</th>
                  <th className="hidden px-4 py-2 lg:table-cell">{t('common.size')}</th>
                  <th className="px-4 py-2">{t('common.status')}</th>
                  <th className="hidden px-4 py-2 xl:table-cell">{t('cases.detail.toolsRun')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-muted">
                {filtered.map((f) => (
                  <tr key={f.artifact_id}>
                    <td className="px-4 py-2">
                      <Text className="font-medium">
                        {f.relative_path || f.source_path || f.artifact_id}
                      </Text>
                    </td>
                    <td className="hidden px-4 py-2 md:table-cell">
                      <Badge variant="outline" size="sm">
                        {f.media_type || f.kind || '—'}
                      </Badge>
                    </td>
                    <td className="hidden px-4 py-2 lg:table-cell">{formatBytes(f.size_bytes)}</td>
                    <td className="px-4 py-2">
                      <Badge variant="flat" size="sm" className="capitalize">
                        {f.status || '—'}
                      </Badge>
                    </td>
                    <td className="hidden max-w-xs truncate px-4 py-2 text-xs text-gray-500 xl:table-cell">
                      {formatToolsSummary(f)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
