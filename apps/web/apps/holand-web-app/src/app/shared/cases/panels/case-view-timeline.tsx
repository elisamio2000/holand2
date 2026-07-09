// ============================================
// Case View — Timeline panel (live logs)
// ============================================

'use client';

import { useMemo } from 'react';
import { Badge, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import { PiListBulletsBold } from 'react-icons/pi';
import { formatEpochSeconds } from '@/app/shared/cases/case-import-ui-mappers';
import type { CaseViewDataContext } from '@/hooks/use-case-view-data';

export default function CaseViewTimelinePanel({ data }: { data: CaseViewDataContext }) {
  const { t } = useTranslation();
  const { detail } = data;

  const logs = useMemo(() => {
    const raw = Array.isArray(detail?.logs) ? detail!.logs : [];
    return [...raw].sort((a, b) => b.ts - a.ts);
  }, [detail]);

  if (!detail) return null;

  return (
    <div className="rounded-lg border border-muted">
      <div className="flex items-center gap-2 border-b border-muted px-4 py-3">
        <PiListBulletsBold className="h-5 w-5 text-primary" />
        <Title as="h6" className="text-sm font-semibold">
          {t('cases.view.tabs.timeline')}
        </Title>
      </div>
      {logs.length === 0 ? (
        <Text className="p-8 text-center text-gray-500">{t('common.noData')}</Text>
      ) : (
        <div className="max-h-[min(60vh,640px)] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-100">
                <th className="px-4 py-2 text-start">{t('common.date')}</th>
                <th className="px-4 py-2">{t('common.status')}</th>
                <th className="px-4 py-2 text-start">{t('common.description')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-muted">
              {logs.map((log, i) => (
                <tr key={`${log.ts}-${i}`}>
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">
                    {formatEpochSeconds(log.ts)}
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant="outline" size="sm">
                      {log.level}
                    </Badge>
                    <Text className="mt-0.5 text-[10px] text-gray-400">[{log.scope}]</Text>
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                    {log.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
