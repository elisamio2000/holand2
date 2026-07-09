'use client';

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, Button, Checkbox, Text } from 'rizzui';
import { reportService, type ReportHistoryItem } from '@/services/report.service';

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function ReportsHistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<ReportHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [compare, setCompare] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    reportService
      .listHistory()
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

  const canCompare = compare.length === 2;
  const hasSuggestedCompare = useMemo(
    () => items.some((item) => Boolean(item.compareToReportId)),
    [items]
  );

  function toggle(reportId: string) {
    setCompare((prev) => {
      if (prev.includes(reportId)) return prev.filter((id) => id !== reportId);
      if (prev.length >= 2) return [prev[1], reportId];
      return [...prev, reportId];
    });
  }

  function runCompare() {
    if (!canCompare) return;
    router.push(`/career-guidance/assessments/compare?ra=${compare[0]}&rb=${compare[1]}`);
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">تاریخچه گزارش‌ها</h1>
      <Text className="mt-3 max-w-4xl text-sm leading-7 text-gray-600">
        گزارش‌های ذخیره‌شده برای پیگیری روند تغییرات، مقایسه نتایج قبلی با جدید، و استخراج خروجی قابل
        ارائه اینجا در دسترس است.
      </Text>

      <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 p-4">
        <Text className="text-sm text-emerald-800">برای مقایسه روند، دقیقاً دو گزارش را انتخاب کن.</Text>
        <Button size="sm" disabled={!canCompare} onClick={runCompare}>
          مقایسه انتخاب‌شده‌ها
        </Button>
      </div>

      {isLoading ? (
        <Text className="mt-6 text-sm text-gray-500">در حال بارگذاری...</Text>
      ) : items.length === 0 ? (
        <Text className="mt-6 text-sm text-gray-500">هنوز گزارشی ثبت نشده است.</Text>
      ) : (
        <section className="mt-6 space-y-3">
          {items.map((item) => (
            <div
              key={item.reportId}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-muted bg-white p-5 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <Checkbox checked={compare.includes(item.reportId)} onChange={() => toggle(item.reportId)} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Text className="font-semibold text-gray-900">
                      {item.studentName ? `${item.studentName} · ` : ''}
                      {item.hollandCode}/{item.mbtiType}
                    </Text>
                    <Badge variant="flat" color="secondary">
                      {item.ageBand}
                    </Badge>
                    <Badge variant="flat" color="info">
                      {Math.round(item.confidenceScore)}٪ اطمینان
                    </Badge>
                  </div>
                  <Text className="mt-1 text-xs text-gray-500">تاریخ: {formatDate(item.createdAt)}</Text>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link href={`/career-guidance/reports/${item.reportId}`} className="text-emerald-700 hover:underline">
                  مشاهده گزارش
                </Link>
                {item.compareToReportId && (
                  <Link
                    href={`/career-guidance/assessments/compare?ra=${item.compareToReportId}&rb=${item.reportId}`}
                    className="text-xs text-indigo-700 hover:underline"
                  >
                    مقایسه با گزارش قبلی
                  </Link>
                )}
              </div>
            </div>
          ))}
        </section>
      )}

      {!hasSuggestedCompare && !isLoading && items.length > 1 && (
        <Text className="mt-4 text-xs text-gray-500">
          برای بعضی کاربران فقط یک گزارش ثبت شده و مقایسه خودکار هنوز در دسترس نیست.
        </Text>
      )}
    </main>
  );
}
