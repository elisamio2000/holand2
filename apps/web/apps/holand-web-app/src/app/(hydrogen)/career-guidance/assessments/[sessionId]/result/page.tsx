// ============================================
// Assessment Result Summary Page
// Quick, encouraging summary shown right after finishing a session: top
// code(s), a radar chart, and a link into the full report.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Badge, Button, Text, Title } from 'rizzui';
import DimensionRadarChart from '@/app/shared/assessment/charts/dimension-radar-chart';
import { assessmentService } from '@/services/assessment.service';
import { useAssessmentFlowStore } from '@/store/assessment-flow.store';
import type { AssessmentResult } from '@/types/assessment.types';

export default function AssessmentResultPage() {
  const params = useParams<{ sessionId: string }>();
  const storedResult = useAssessmentFlowStore((s) => s.result);

  const [result, setResult] = useState<AssessmentResult | null>(storedResult);
  const [isLoading, setIsLoading] = useState(!storedResult);

  useEffect(() => {
    if (storedResult) {
      setResult(storedResult);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    assessmentService
      .getResult(params.sessionId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.sessionId, storedResult]);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-gray-500">در حال آماده‌سازی نتیجه...</Text>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="mx-auto w-full max-w-3xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-gray-500">نتیجه‌ای برای این آزمون پیدا نشد.</Text>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl p-6 sm:p-8 lg:p-10">
      <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">
        نتیجه آزمون آماده است 🎉
      </Title>
      <Text className="mt-3 text-sm leading-7 text-gray-600">
        این یک خلاصه سریع است. برای تحلیل کامل، وارد گزارش تفصیلی شو.
      </Text>

      <div className="mt-6 flex flex-wrap gap-3">
        {result.holland && (
          <Badge variant="flat" color="success" className="px-4 py-2 text-sm">
            کد هالند: {result.holland.top3Code}
          </Badge>
        )}
        {result.mbti && (
          <Badge variant="flat" color="info" className="px-4 py-2 text-sm">
            تیپ MBTI: {result.mbti.typeCode}
          </Badge>
        )}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2">
        {result.holland && (
          <DimensionRadarChart title="نمودار هالند (RIASEC)" dimensions={result.holland.dimensions} />
        )}
        {result.mbti && (
          <DimensionRadarChart title="نمودار MBTI" dimensions={result.mbti.dimensions} />
        )}
      </div>

      <div className="mt-10 flex justify-end">
        <Link href={`/career-guidance/reports/${result.sessionId}`}>
          <Button size="lg" className="min-w-[180px]">
            مشاهده گزارش کامل
          </Button>
        </Link>
      </div>
    </main>
  );
}
