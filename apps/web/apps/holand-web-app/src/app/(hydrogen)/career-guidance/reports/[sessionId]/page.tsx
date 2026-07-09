// ============================================
// Full Report Page
// Explainable, actionable report: RadarChart + DimensionBars per test,
// strengths/growth areas, career & major recommendations, a staged action
// plan (3/6/12 months), and the mandatory ethical disclaimer.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge, Button, Text, Title } from 'rizzui';
import WidgetCard from '@core/components/cards/widget-card';
import { reportService, type GeneratedReportResponse } from '@/services/report.service';
import { analyticsService } from '@/services/analytics.service';

const safeList = (items?: string[]) => (items && items.length ? items : ['—']);

export default function FullReportPage() {
  const params = useParams<{ sessionId: string }>();
  const reportRef = params.sessionId;
  const [report, setReport] = useState<GeneratedReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    reportService
      .getGeneratedReport(reportRef)
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
  }, [reportRef]);

  useEffect(() => {
    analyticsService
      .trackEvent({
        session_id: reportRef,
        event_name: 'report_opened',
        step: 'report_opened',
      })
      .catch(() => undefined);
  }, [reportRef]);

  useEffect(() => {
    if (!report) return;
    Promise.allSettled([
      analyticsService.trackEvent({
        session_id: reportRef,
        event_name: 'report_interpretation_viewed',
        step: 'report_interpretation_viewed',
      }),
      analyticsService.trackEvent({
        session_id: reportRef,
        event_name: 'report_action_plan_viewed',
        step: 'report_action_plan_viewed',
      }),
      analyticsService.trackEvent({
        session_id: reportRef,
        event_name: 'report_recommendations_viewed',
        step: 'report_recommendations_viewed',
      }),
    ]).catch(() => undefined);
  }, [reportRef, report]);

  async function handleExport() {
    if (!report?.id) return;
    setIsExporting(true);
    setExportError(null);
    try {
      let blob: Blob;
      let extension = 'pdf';
      try {
        blob = await reportService.exportReport(report.id, 'pdf');
      } catch {
        blob = await reportService.exportReport(report.id, 'html');
        extension = 'html';
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `holand-report-${report.id}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('دریافت فایل گزارش با خطا مواجه شد.');
    } finally {
      setIsExporting(false);
    }
  }

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
      <Text className="mt-3 text-sm leading-7 text-gray-600">{report.summary_card.headline_fa}</Text>
      <div className="mt-3 flex flex-wrap gap-3">
        <Badge variant="flat" color="success" className="px-4 py-2 text-sm">
          کد هالند: {report.holland_code}
        </Badge>
        <Badge variant="flat" color="info" className="px-4 py-2 text-sm">
          تیپ MBTI: {report.mbti_type}
        </Badge>
        <Badge variant="flat" color="secondary" className="px-4 py-2 text-sm">
          گروه سنی: {report.age_band}
        </Badge>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button size="sm" variant="outline" isLoading={isExporting} onClick={handleExport}>
          خروجی گزارش
        </Button>
        {exportError && <Text className="text-xs text-red-600">{exportError}</Text>}
      </div>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title="خلاصه پیشنهادهای شغلی">
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            {safeList(report.summary_card.top_careers_fa).map((item, idx) => (
              <li key={`${item}-${idx}`} className="rounded-lg bg-emerald-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </WidgetCard>
        <WidgetCard title="خلاصه پیشنهادهای تحصیلی">
          <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
            {safeList(report.summary_card.top_majors_fa).map((item, idx) => (
              <li key={`${item}-${idx}`} className="rounded-lg bg-indigo-50 px-4 py-3">
                {item}
              </li>
            ))}
          </ul>
        </WidgetCard>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title="تفسیر روان‌سنجی">
          <Text className="mt-3 text-sm leading-7 text-gray-700">
            {report.detailed_interpretation.psychometric_fa || '—'}
          </Text>
        </WidgetCard>
        <WidgetCard title="تناسب رفتاری و محیط کاری">
          <Text className="mt-3 text-sm leading-7 text-gray-700">
            {report.detailed_interpretation.behavioral_fit_fa || '—'}
          </Text>
        </WidgetCard>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title="تحلیل مسیر شغلی/تحصیلی">
          <Text className="mt-3 text-sm leading-7 text-gray-700">
            {report.detailed_interpretation.career_major_fa || '—'}
          </Text>
        </WidgetCard>
        <WidgetCard title="رشد مهارتی">
          <Text className="mt-3 text-sm leading-7 text-gray-700">
            {report.detailed_interpretation.skill_growth_fa || '—'}
          </Text>
        </WidgetCard>
      </section>

      <section className="mt-8 grid gap-6 sm:grid-cols-2">
        <WidgetCard title="پیشنهاد مسیرهای شغلی">
          <ul className="mt-4 space-y-3">
            {(report.recommendations.careers.length ? report.recommendations.careers : []).map(
              (item) => (
                <li key={item.title_fa} className="rounded-lg border border-muted p-4">
                  <div className="flex items-center justify-between">
                    <Text className="font-semibold text-gray-900">{item.title_fa}</Text>
                    <Text className="text-xs font-semibold text-emerald-700">
                      {Math.round(item.fit_score)}٪ تطابق
                    </Text>
                  </div>
                  <Text className="mt-1 text-xs leading-5 text-gray-500">{item.why_fa}</Text>
                </li>
              )
            )}
            {!report.recommendations.careers.length && (
              <li className="rounded-lg bg-gray-50 px-4 py-3 text-gray-500">موردی ثبت نشده است.</li>
            )}
          </ul>
        </WidgetCard>
        <WidgetCard title="پیشنهاد رشته‌های تحصیلی">
          <ul className="mt-4 space-y-3">
            {(report.recommendations.majors.length ? report.recommendations.majors : []).map((item) => (
              <li key={item.title_fa} className="rounded-lg border border-muted p-4">
                <div className="flex items-center justify-between">
                  <Text className="font-semibold text-gray-900">{item.title_fa}</Text>
                  <Text className="text-xs font-semibold text-indigo-700">
                    {Math.round(item.fit_score)}٪ تطابق
                  </Text>
                </div>
                <Text className="mt-1 text-xs leading-5 text-gray-500">{item.why_fa}</Text>
              </li>
            ))}
            {!report.recommendations.majors.length && (
              <li className="rounded-lg bg-gray-50 px-4 py-3 text-gray-500">موردی ثبت نشده است.</li>
            )}
          </ul>
        </WidgetCard>
      </section>

      <section className="mt-8">
        <WidgetCard title="برنامه اقدام مرحله‌ای">
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-muted p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                ۳ ماه آینده
              </Text>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-600">
                {safeList(report.action_plan.short_term_3_months_fa).map((item, idx) => (
                  <li key={`st-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-muted p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                ۶ ماه آینده
              </Text>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-600">
                {safeList(report.action_plan.mid_term_6_months_fa).map((item, idx) => (
                  <li key={`mt-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-muted p-4">
              <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                ۱۲ ماه آینده
              </Text>
              <ul className="mt-2 space-y-2 text-xs leading-5 text-gray-600">
                {safeList(report.action_plan.long_term_12_months_fa).map((item, idx) => (
                  <li key={`lt-${idx}`}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </WidgetCard>
      </section>

      <section className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5">
        <ul className="space-y-2 text-xs leading-6 text-amber-800">
          {safeList(report.risk_flags).map((flag, idx) => (
            <li key={`risk-${idx}`}>⚠️ {flag}</li>
          ))}
        </ul>
      </section>

      <section className="mt-4 rounded-xl border border-muted bg-white p-5">
        <Text className="text-xs leading-6 text-gray-700">
          امتیاز اطمینان گزارش: <span className="font-semibold">{Math.round(report.confidence_score)}٪</span>
        </Text>
      </section>
    </main>
  );
}
