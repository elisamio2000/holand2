// ============================================
// Compare Assessments Page
// Side-by-side + overlaid comparison of two completed assessment reports
// (e.g. a retake a few months later) so the user/counselor can see how
// dimension scores shifted over time.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Badge, Text, Title } from 'rizzui';
import WidgetCard from '@core/components/cards/widget-card';
import DimensionRadarChart from '@/app/shared/assessment/charts/dimension-radar-chart';
import { reportService } from '@/services/report.service';
import type { AssessmentReport, DimensionScore } from '@/types/assessment.types';

/** Picks the "primary" dimension set (Holland if present, otherwise MBTI) for comparison. */
function getPrimaryDimensions(
  report: AssessmentReport
): { dimensions: DimensionScore[]; code: string; kind: string } | null {
  if (report.holland) return { dimensions: report.holland.dimensions, code: report.holland.top3Code, kind: 'هالند (RIASEC)' };
  if (report.mbti) return { dimensions: report.mbti.dimensions, code: report.mbti.typeCode, kind: 'MBTI' };
  return null;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CompareAssessmentsPage() {
  const searchParams = useSearchParams();
  const idA = searchParams.get('a');
  const idB = searchParams.get('b');

  const [reportA, setReportA] = useState<AssessmentReport | null>(null);
  const [reportB, setReportB] = useState<AssessmentReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!idA || !idB) {
      setError('برای مقایسه باید دو آزمون انتخاب شود.');
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    Promise.all([reportService.getReport(idA), reportService.getReport(idB)])
      .then(([a, b]) => {
        if (!cancelled) {
          setReportA(a);
          setReportB(b);
        }
      })
      .catch(() => {
        if (!cancelled) setError('دریافت یکی از گزارش‌ها با خطا مواجه شد.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idA, idB]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-gray-500">در حال بارگذاری مقایسه...</Text>
      </main>
    );
  }

  if (error || !reportA || !reportB) {
    return (
      <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
        <WidgetCard title="خطا در مقایسه">
          <Text className="mt-3 text-sm text-gray-600">
            {error ?? 'حداقل یکی از گزارش‌ها پیدا نشد.'}
          </Text>
          <Link
            href="/career-guidance/assessments/history"
            className="mt-4 inline-block text-sm font-medium text-emerald-700 hover:underline"
          >
            بازگشت به تاریخچه آزمون‌ها
          </Link>
        </WidgetCard>
      </main>
    );
  }

  const primaryA = getPrimaryDimensions(reportA);
  const primaryB = getPrimaryDimensions(reportB);

  const deltas =
    primaryA && primaryB
      ? primaryA.dimensions.map((dimA) => {
          const dimB = primaryB.dimensions.find((d) => d.dimension === dimA.dimension);
          const delta = (dimB?.normalizedScore ?? 0) - dimA.normalizedScore;
          return { dimension: dimA.dimension, label: dimA.label, from: dimA.normalizedScore, to: dimB?.normalizedScore ?? 0, delta };
        })
      : [];

  return (
    <main className="mx-auto w-full max-w-5xl p-6 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">
          مقایسه دو آزمون
        </Title>
        <Link
          href="/career-guidance/assessments/history"
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          بازگشت به تاریخچه
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WidgetCard title="آزمون اول (پایه)">
          <Badge variant="flat" color="secondary" className="mt-2">
            {primaryA?.kind ?? '—'} · {primaryA?.code ?? '—'}
          </Badge>
          <Text className="mt-2 text-xs text-gray-500">
            تاریخ تکمیل: {formatDate(reportA.completedAt)}
          </Text>
        </WidgetCard>
        <WidgetCard title="آزمون دوم (جدید)">
          <Badge variant="flat" color="success" className="mt-2">
            {primaryB?.kind ?? '—'} · {primaryB?.code ?? '—'}
          </Badge>
          <Text className="mt-2 text-xs text-gray-500">
            تاریخ تکمیل: {formatDate(reportB.completedAt)}
          </Text>
        </WidgetCard>
      </div>

      {primaryA && primaryB && (
        <div className="mt-6">
          <DimensionRadarChart
            title="نمودار هم‌پوشان ابعاد"
            dimensions={primaryA.dimensions}
            seriesLabel="آزمون اول"
            compareDimensions={primaryB.dimensions}
            compareLabel="آزمون دوم"
          />
        </div>
      )}

      {deltas.length > 0 && (
        <WidgetCard title="تغییرات هر بعد" className="mt-6">
          <div className="mt-3 space-y-3">
            {deltas.map((d) => (
              <div key={d.dimension} className="flex items-center justify-between gap-3">
                <Text className="text-sm font-medium text-gray-800">{d.label}</Text>
                <div className="flex items-center gap-2 text-sm">
                  <Text className="text-gray-500">{d.from.toFixed(0)}%</Text>
                  <Text className="text-gray-400">→</Text>
                  <Text className="text-gray-700">{d.to.toFixed(0)}%</Text>
                  <Badge
                    variant="flat"
                    color={d.delta > 0 ? 'success' : d.delta < 0 ? 'danger' : 'secondary'}
                  >
                    {d.delta > 0 ? '+' : ''}
                    {d.delta.toFixed(0)}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </WidgetCard>
      )}
    </main>
  );
}
