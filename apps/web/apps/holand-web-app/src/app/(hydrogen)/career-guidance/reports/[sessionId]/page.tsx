// ============================================
// Full Report Page
// Explainable, actionable report: RadarChart + DimensionBars per test,
// strengths/growth areas, career & major recommendations, a staged action
// plan (3/6/12 months), and the mandatory ethical disclaimer.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Text, Title } from 'rizzui';
import WidgetCard from '@core/components/cards/widget-card';
import DimensionRadarChart from '@/app/shared/assessment/charts/dimension-radar-chart';
import DimensionBars from '@/app/shared/assessment/charts/dimension-bars';
import { reportService } from '@/services/report.service';
import type { AssessmentReport } from '@/types/assessment.types';

const HORIZON_LABEL: Record<string, string> = {
  '3m': '۳ ماه آینده',
  '6m': '۶ ماه آینده',
  '12m': '۱۲ ماه آینده',
};

export default function FullReportPage() {
  const params = useParams<{ sessionId: string }>();
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    reportService
      .getReport(params.sessionId)
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch(() => {
        if (!cancelled) setError('دریافت گزارش با خطا مواجه شد.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-gray-500">در حال بارگذاری گزارش...</Text>
      </main>
    );
  }

  if (error || !report) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-red-600">{error ?? 'گزارشی پیدا نشد.'}</Text>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
      <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">
        گزارش کامل هدایت شغلی
      </Title>
      <div className="mt-3 flex flex-wrap gap-3">
        {report.holland && (
          <Badge variant="flat" color="success" className="px-4 py-2 text-sm">
            کد هالند: {report.holland.top3Code}
          </Badge>
        )}
        {report.mbti && (
          <Badge variant="flat" color="info" className="px-4 py-2 text-sm">
            تیپ MBTI: {report.mbti.typeCode}
          </Badge>
        )}
      </div>

      {/* Dimension charts */}
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        {report.holland && (
          <>
            <DimensionRadarChart title="نمودار هالند (RIASEC)" dimensions={report.holland.dimensions} />
            <WidgetCard title="جزئیات ابعاد هالند">
              <div className="mt-5">
                <DimensionBars dimensions={report.holland.dimensions} />
              </div>
            </WidgetCard>
          </>
        )}
        {report.mbti && (
          <>
            <DimensionRadarChart title="نمودار MBTI" dimensions={report.mbti.dimensions} />
            <WidgetCard title="جزئیات ابعاد MBTI">
              <div className="mt-5">
                <DimensionBars dimensions={report.mbti.dimensions} barColorClassName="bg-indigo-500" />
              </div>
            </WidgetCard>
          </>
        )}
      </section>

      {/* Strengths / growth areas */}
      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title="نقاط قوت">
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            {report.strengths.map((item) => (
              <li key={item} className="rounded-lg bg-emerald-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </WidgetCard>
        <WidgetCard title="نقاط قابل رشد">
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            {report.growthAreas.length ? (
              report.growthAreas.map((item) => (
                <li key={item} className="rounded-lg bg-amber-50 px-4 py-3">
                  {item}
                </li>
              ))
            ) : (
              <li className="rounded-lg bg-gray-50 px-4 py-3 text-gray-500">موردی ثبت نشده است.</li>
            )}
          </ul>
        </WidgetCard>
      </section>

      {/* Recommendations */}
      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title="پیشنهاد مسیرهای شغلی">
          <ul className="mt-4 space-y-3">
            {report.careers.map((item) => (
              <li key={item.title} className="rounded-lg border border-muted p-4">
                <div className="flex items-center justify-between">
                  <Text className="font-semibold text-gray-900">{item.title}</Text>
                  <Text className="text-xs font-semibold text-emerald-700">
                    {Math.round(item.fitScore * 100)}٪ تطابق
                  </Text>
                </div>
                <Text className="mt-1 text-xs leading-5 text-gray-500">{item.why}</Text>
              </li>
            ))}
          </ul>
        </WidgetCard>
        <WidgetCard title="پیشنهاد رشته‌های تحصیلی">
          <ul className="mt-4 space-y-3">
            {report.majors.map((item) => (
              <li key={item.title} className="rounded-lg border border-muted p-4">
                <div className="flex items-center justify-between">
                  <Text className="font-semibold text-gray-900">{item.title}</Text>
                  <Text className="text-xs font-semibold text-indigo-700">
                    {Math.round(item.fitScore * 100)}٪ تطابق
                  </Text>
                </div>
                <Text className="mt-1 text-xs leading-5 text-gray-500">{item.why}</Text>
              </li>
            ))}
          </ul>
        </WidgetCard>
      </section>

      {/* Action plan */}
      <section className="mt-8">
        <WidgetCard title="برنامه اقدام مرحله‌ای">
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {report.actionPlan.map((step) => (
              <div key={step.horizon} className="rounded-xl border border-muted p-4">
                <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {HORIZON_LABEL[step.horizon] ?? step.horizon}
                </Text>
                <Text className="mt-2 font-semibold text-gray-900">{step.title}</Text>
                <Text className="mt-1 text-xs leading-5 text-gray-500">{step.description}</Text>
              </div>
            ))}
          </div>
        </WidgetCard>
      </section>

      {/* Disclaimer */}
      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <Text className="text-xs leading-6 text-amber-800">⚠️ {report.disclaimer}</Text>
      </section>
    </main>
  );
}
