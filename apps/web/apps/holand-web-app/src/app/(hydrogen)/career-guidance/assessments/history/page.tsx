// ============================================
// My Assessments — History Page
// Lists the current user's past/ongoing assessment sessions so they can
// resume an in-progress test or jump back into a completed report.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Text, Title } from 'rizzui';
import WidgetCard from '@core/components/cards/widget-card';
import { assessmentService } from '@/services/assessment.service';
import type { AssessmentHistoryItem, TestType } from '@/types/assessment.types';

const TEST_TYPE_LABEL: Record<TestType, string> = {
  holland: 'هالند (RIASEC)',
  mbti: 'MBTI',
  combined: 'ترکیبی',
};

const STATUS_META: Record<string, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  completed: { label: 'تکمیل شده', color: 'success' },
  in_progress: { label: 'در حال انجام', color: 'warning' },
  abandoned: { label: 'رها شده', color: 'danger' },
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AssessmentHistoryPage() {
  const [items, setItems] = useState<AssessmentHistoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    assessmentService
      .listMySessions()
      .then((data) => {
        if (!cancelled) setItems(data);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="mx-auto w-full max-w-4xl p-6 sm:p-8 lg:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">
          تاریخچه آزمون‌های من
        </Title>
        <Link href="/career-guidance/assessments/start">
          <Button>شروع آزمون جدید</Button>
        </Link>
      </div>
      <Text className="mt-3 text-sm leading-7 text-gray-600">
        آزمون‌های قبلی خودت را اینجا می‌بینی — می‌توانی آزمون نیمه‌تمام را ادامه بدهی یا گزارش کامل
        آزمون‌های تکمیل‌شده را دوباره مرور کنی.
      </Text>

      <section className="mt-8">
        {isLoading ? (
          <Text className="text-sm text-gray-500">در حال بارگذاری...</Text>
        ) : !items || items.length === 0 ? (
          <WidgetCard title="هنوز آزمونی ثبت نشده">
            <Text className="mt-3 text-sm text-gray-500">
              با شروع اولین آزمون، تاریخچه‌ات اینجا نمایش داده می‌شود.
            </Text>
          </WidgetCard>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const statusMeta = STATUS_META[item.status] ?? STATUS_META.in_progress;
              return (
                <div
                  key={item.sessionId}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-muted bg-white p-5 shadow-sm"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <Text className="font-semibold text-gray-900">
                        {TEST_TYPE_LABEL[item.testType] ?? item.testType}
                      </Text>
                      <Badge variant="flat" color={statusMeta.color}>
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <Text className="mt-1 text-xs text-gray-500">
                      شروع: {formatDate(item.startedAt)}
                      {item.completedAt ? ` · پایان: ${formatDate(item.completedAt)}` : ''}
                    </Text>
                    {item.topCode && (
                      <Text className="mt-1 text-xs font-medium text-emerald-700">
                        کد نتیجه: {item.topCode}
                      </Text>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {item.status !== 'completed' && (
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-amber-500"
                          style={{ width: `${item.progressPercent}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'completed' ? (
                      <Link href={`/career-guidance/reports/${item.sessionId}`}>
                        <Button variant="outline" size="sm">
                          مشاهده گزارش
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/career-guidance/assessments/${item.sessionId}`}>
                        <Button size="sm">ادامه آزمون</Button>
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
