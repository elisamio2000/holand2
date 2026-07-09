// ============================================
// Counselor Dashboard
// Cohort-level stats (completion funnel, dimension averages) plus a table
// of students/sessions the counselor is following, with links into each
// student's full report.
// ============================================

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge, Text, Title } from 'rizzui';
import WidgetCard from '@core/components/cards/widget-card';
import DimensionRadarChart from '@/app/shared/assessment/charts/dimension-radar-chart';
import { counselorService } from '@/services/counselor.service';
import type { CounselorDashboardData } from '@/types/assessment.types';

const STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'danger' }> = {
  completed: { label: 'تکمیل شده', color: 'success' },
  in_progress: { label: 'در حال انجام', color: 'warning' },
  abandoned: { label: 'رها شده', color: 'danger' },
};

export default function CounselorDashboardPage() {
  const [data, setData] = useState<CounselorDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    counselorService
      .getDashboard()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (isLoading) {
    return (
      <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-gray-500">در حال بارگذاری داشبورد مشاور...</Text>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
        <Text className="text-sm text-red-600">داده‌ای برای نمایش پیدا نشد.</Text>
      </main>
    );
  }

  const { stats, students } = data;

  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <Title as="h1" className="text-2xl font-bold text-gray-900 sm:text-3xl">
        داشبورد مشاور
      </Title>
      <Text className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
        روند تکمیل آزمون دانش‌آموزان و میانگین ابعاد گروه را از اینجا پیگیری کن.
      </Text>

      {/* Stat cards */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="کل دانش‌آموزان" value={stats.totalStudents} />
        <StatCard label="آزمون‌های تکمیل‌شده" value={stats.completedAssessments} />
        <StatCard label="در حال انجام" value={stats.inProgressAssessments} />
        <StatCard label="میانگین درصد تکمیل" value={`${stats.averageCompletionPercent}%`} />
      </section>

      {/* Cohort dimension averages */}
      <section className="mt-8">
        <DimensionRadarChart title="میانگین ابعاد هالند گروه" dimensions={stats.dimensionAverages} />
      </section>

      {/* Students table */}
      <section className="mt-8">
        <WidgetCard title="لیست دانش‌آموزان">
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[640px] text-right text-sm">
              <thead>
                <tr className="border-b border-muted text-xs uppercase text-gray-500">
                  <th className="py-2 pe-4 font-medium">نام</th>
                  <th className="py-2 pe-4 font-medium">گروه سنی</th>
                  <th className="py-2 pe-4 font-medium">وضعیت</th>
                  <th className="py-2 pe-4 font-medium">پیشرفت</th>
                  <th className="py-2 pe-4 font-medium">کد نتیجه</th>
                  <th className="py-2 pe-4 font-medium">روند اطمینان</th>
                  <th className="py-2 font-medium">اقدام</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student) => {
                  const statusMeta = STATUS_LABEL[student.status] ?? STATUS_LABEL.in_progress;
                  return (
                    <tr key={student.sessionId} className="border-b border-muted/60">
                      <td className="py-3 pe-4 font-medium text-gray-900">{student.studentName}</td>
                      <td className="py-3 pe-4 text-gray-600">{student.ageBand}</td>
                      <td className="py-3 pe-4">
                        <Badge variant="flat" color={statusMeta.color}>
                          {statusMeta.label}
                        </Badge>
                      </td>
                      <td className="py-3 pe-4">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${student.progressPercent}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 pe-4 text-gray-600">{student.topCode ?? '—'}</td>
                      <td className="py-3 pe-4">
                        {student.latestConfidenceScore != null ? (
                          <div className="flex items-center gap-2">
                            <Text className="text-xs text-gray-700">
                              {Math.round(student.latestConfidenceScore)}%
                            </Text>
                            {student.confidenceDelta != null && (
                              <Badge
                                variant="flat"
                                color={
                                  student.confidenceDelta > 0
                                    ? 'success'
                                    : student.confidenceDelta < 0
                                      ? 'danger'
                                      : 'secondary'
                                }
                              >
                                {student.confidenceDelta > 0 ? '+' : ''}
                                {student.confidenceDelta.toFixed(1)}%
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <Text className="text-gray-400">—</Text>
                        )}
                      </td>
                      <td className="py-3">
                        {student.status === 'completed' ? (
                          <div className="flex items-center gap-3">
                            <Link
                              href={`/career-guidance/reports/${student.latestReportId ?? student.sessionId}`}
                              className="text-emerald-700 hover:underline"
                            >
                              مشاهده گزارش
                            </Link>
                            {student.latestReportId && student.compareReportId && (
                              <Link
                                href={`/career-guidance/assessments/compare?ra=${student.compareReportId}&rb=${student.latestReportId}`}
                                className="text-xs text-indigo-700 hover:underline"
                              >
                                مقایسه روند
                              </Link>
                            )}
                          </div>
                        ) : (
                          <Text className="text-gray-400">—</Text>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </WidgetCard>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-muted bg-white p-5 shadow-sm">
      <Text className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</Text>
      <Text className="mt-2 text-2xl font-bold text-gray-900">{value}</Text>
    </div>
  );
}
