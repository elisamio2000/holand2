// ============================================
// ReportBuilderView — Custom report builder
// Rich preview with report type cards and builder layout
// ============================================
'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Title, Text, Badge, Button } from 'rizzui';
import {
  PiNewspaperClippingBold,
  PiPlusBold,
  PiChartBarBold,
  PiClockCountdownBold,
  PiClockClockwiseBold,
  PiFilePdfBold,
  PiChartPieSliceBold,
  PiCalendarBlankBold,
  PiArrowSquareOutBold,
  PiFunnelSimpleBold,
  PiRocketLaunchBold,
  PiTableBold,
  PiChartLineUpBold,
  PiChartDonutBold,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';
import BackendNotAvailable from '@/app/shared/backend-not-available';

/**
 * ReportBuilderView — Custom report generation view.
 *
 * Rich UI with:
 * - Header with report creation controls
 * - Tab navigation (New Report, Templates, Scheduled, History)
 * - Report type selection cards
 * - Builder preview wireframe
 * - Feature capabilities grid
 * - BNA component for required endpoints
 *
 * @version 0.21.0
 */
export default function ReportBuilderView() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('new');

  /** Tab definitions */
  const tabs = [
    { key: 'new', label: t('reports.builder.newReport'), icon: PiPlusBold },
    { key: 'templates', label: t('reports.builder.templates'), icon: PiFilePdfBold },
    { key: 'scheduled', label: t('reports.builder.scheduled'), icon: PiClockCountdownBold },
    { key: 'history', label: t('reports.builder.history'), icon: PiClockClockwiseBold },
  ];

  /** Report type cards — descriptive layout preview */
  const reportTypes = [
    {
      icon: PiChartBarBold,
      title: t('reports.features.customCharts'),
      description: t('reports.features.customChartsDesc'),
      color: 'text-blue-500',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
      border: 'border-blue-200 dark:border-blue-800',
    },
    {
      icon: PiTableBold,
      title: t('reports.features.dataFilters'),
      description: t('reports.features.dataFiltersDesc'),
      color: 'text-green-500',
      bg: 'bg-green-50 dark:bg-green-950/30',
      border: 'border-green-200 dark:border-green-800',
    },
    {
      icon: PiCalendarBlankBold,
      title: t('reports.features.scheduling'),
      description: t('reports.features.schedulingDesc'),
      color: 'text-amber-500',
      bg: 'bg-amber-50 dark:bg-amber-950/30',
      border: 'border-amber-200 dark:border-amber-800',
    },
    {
      icon: PiArrowSquareOutBold,
      title: t('reports.features.exportFormats'),
      description: t('reports.features.exportFormatsDesc'),
      color: 'text-purple-500',
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      border: 'border-purple-200 dark:border-purple-800',
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header Section ── */}
      <div className="rounded-xl border border-muted bg-gray-0 p-6 dark:bg-gray-50">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <PiNewspaperClippingBold className="h-7 w-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Title as="h4" className="text-lg font-semibold">
                  {t('reports.builder.title')}
                </Title>
                <Badge
                  variant="flat"
                  className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  {t('common.comingSoon')}
                </Badge>
              </div>
              <Text className="mt-0.5 text-sm text-gray-500">
                {t('reports.builder.description')}
              </Text>
            </div>
          </div>

          <Button variant="solid" className="gap-1.5" disabled>
            <PiPlusBold className="h-4 w-4" />
            {t('reports.builder.newReport')}
          </Button>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 overflow-x-auto rounded-xl border border-muted bg-gray-0 p-1.5 dark:bg-gray-50">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all',
              activeTab === tab.key
                ? 'bg-primary text-white shadow-sm'
                : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-100'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Report Type Cards ── */}
      <div>
        <Title as="h5" className="mb-4 text-base font-semibold">
          {t('common.plannedFeatures')}
        </Title>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {reportTypes.map((type) => (
            <div
              key={type.title}
              className={cn(
                'group rounded-xl border bg-gray-0 p-6 transition-all hover:shadow-md dark:bg-gray-50',
                type.border
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    'flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl',
                    type.bg
                  )}
                >
                  <type.icon className={cn('h-7 w-7', type.color)} />
                </div>
                <div>
                  <Title as="h6" className="text-sm font-semibold">
                    {type.title}
                  </Title>
                  <Text className="mt-1 text-xs leading-relaxed text-gray-500">
                    {type.description}
                  </Text>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Builder Wireframe Preview ── */}
      <div className="rounded-xl border border-muted bg-gray-0 dark:bg-gray-50">
        <div className="flex items-center justify-between border-b border-muted px-6 py-4">
          <Text className="text-sm font-semibold">{t('reports.builder.newReport')}</Text>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled>
              <PiFunnelSimpleBold className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" disabled>
              <PiArrowSquareOutBold className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-4 p-6">
          {/* Chart preview placeholders */}
          <div className="col-span-8 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-12 dark:border-gray-700 dark:bg-gray-100/30">
            <PiChartLineUpBold className="mb-2 h-10 w-10 text-gray-300 dark:text-gray-600" />
            <Text className="text-sm text-gray-400">{t('reports.features.customCharts')}</Text>
          </div>
          <div className="col-span-4 space-y-4">
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 dark:border-gray-700 dark:bg-gray-100/30">
              <PiChartPieSliceBold className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <Text className="text-xs text-gray-400">{t('common.noData')}</Text>
            </div>
            <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50/50 p-8 dark:border-gray-700 dark:bg-gray-100/30">
              <PiChartDonutBold className="mb-2 h-8 w-8 text-gray-300 dark:text-gray-600" />
              <Text className="text-xs text-gray-400">{t('common.noData')}</Text>
            </div>
          </div>
        </div>
      </div>

      {/* ── Coming Soon Banner ── */}
      <div className="relative overflow-hidden rounded-xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 p-8">
        <div className="relative flex flex-col items-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <PiRocketLaunchBold className="h-8 w-8 text-primary" />
          </div>
          <Title as="h3" className="text-xl font-bold">
            {t('common.featurePreview')}
          </Title>
          <Text className="mx-auto mt-2 max-w-md text-gray-500">
            {t('reports.features.comingSoonDesc')}
          </Text>
        </div>
      </div>

      {/* ── Backend Not Available ── */}
      <BackendNotAvailable
        title="Reports API"
        description="The backend endpoints for report generation have not been implemented yet."
        version="0.21.0"
        endpoints={[
          { method: 'GET', path: '/reports/templates', description: 'List report templates' },
          { method: 'POST', path: '/reports/generate', description: 'Generate a new report' },
          { method: 'GET', path: '/reports/', description: 'List generated reports' },
          { method: 'GET', path: '/reports/{id}/download', description: 'Download report file' },
          { method: 'POST', path: '/reports/schedule', description: 'Schedule recurring report' },
          { method: 'GET', path: '/reports/scheduled', description: 'List scheduled reports' },
        ]}
      />
    </div>
  );
}
