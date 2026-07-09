'use client';

import { useEffect, useState } from 'react';
import { Badge, Loader, Text, Title } from 'rizzui';
import { useTranslation } from 'react-i18next';
import CaseViewDataBanner from '@/app/shared/cases/panels/case-view-data-banner';
import { formatEpochSeconds } from '@/app/shared/cases/case-import-ui-mappers';
import {
  loadCaseSummary,
  type CaseSummaryData,
} from '@/services/case-summary-provider';
import type { CaseViewDataContext } from '@/hooks/use-case-view-data';

export default function CaseViewAiSummaryPanel({ data }: { data: CaseViewDataContext }) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<CaseSummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadCaseSummary(data.detail?.case_id ?? '', data.detail).then((s) => {
      if (!cancelled) {
        setSummary(s);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [data.detail]);

  if (loading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <Loader variant="spinner" size="lg" />
      </div>
    );
  }

  if (!summary || summary.source === 'empty') {
    return <Text className="text-gray-500">{t('common.noData')}</Text>;
  }

  const bannerVariant =
    summary.source === 'api' ? undefined : ('derived' as const);

  return (
    <div className="space-y-4">
      {bannerVariant ? <CaseViewDataBanner variant={bannerVariant} /> : null}
      <div className="rounded-lg border border-muted p-5">
        <Title as="h6" className="mb-2 text-sm font-semibold">
          {t('cases.view.aiSummary.executiveSummary')}
        </Title>
        <Text className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
          {summary.executive_summary}
        </Text>
      </div>
      {summary.key_findings.length > 0 ? (
        <div className="rounded-lg border border-muted p-5">
          <Title as="h6" className="mb-3 text-sm font-semibold">
            {t('cases.view.aiSummary.keyFindings')}
          </Title>
          <ul className="list-inside list-disc space-y-1 text-sm text-gray-700 dark:text-gray-300">
            {summary.key_findings.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="rounded-lg border border-muted p-5">
        <Title as="h6" className="mb-3 text-sm font-semibold">
          {t('cases.view.aiSummary.entities')}
        </Title>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Text className="mb-2 text-xs font-medium text-gray-500">
              {t('cases.view.aiSummary.persons')}
            </Text>
            <div className="flex flex-wrap gap-1">
              {summary.entities.persons.length ? (
                summary.entities.persons.map((p) => (
                  <Badge key={p} variant="flat" size="sm">
                    {p}
                  </Badge>
                ))
              ) : (
                <Text className="text-xs text-gray-400">—</Text>
              )}
            </div>
          </div>
          <div>
            <Text className="mb-2 text-xs font-medium text-gray-500">
              {t('cases.view.aiSummary.organizations')}
            </Text>
            <div className="flex flex-wrap gap-1">
              {summary.entities.organizations.length ? (
                summary.entities.organizations.map((o) => (
                  <Badge key={o} variant="flat" color="secondary" size="sm">
                    {o}
                  </Badge>
                ))
              ) : (
                <Text className="text-xs text-gray-400">—</Text>
              )}
            </div>
          </div>
          <div>
            <Text className="mb-2 text-xs font-medium text-gray-500">
              {t('cases.view.aiSummary.locations')}
            </Text>
            <div className="flex flex-wrap gap-1">
              {summary.entities.locations.length ? (
                summary.entities.locations.map((l) => (
                  <Badge key={l} variant="flat" color="info" size="sm">
                    {l}
                  </Badge>
                ))
              ) : (
                <Text className="text-xs text-gray-400">—</Text>
              )}
            </div>
          </div>
        </div>
      </div>
      {summary.generated_at ? (
        <Text className="text-xs text-gray-500">
          {t('cases.view.aiSummary.generatedAt', {
            date: formatEpochSeconds(Math.floor(summary.generated_at / 1000)),
          })}
        </Text>
      ) : null}
    </div>
  );
}




