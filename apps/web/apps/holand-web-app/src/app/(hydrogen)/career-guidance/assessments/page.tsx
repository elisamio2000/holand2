'use client';

import { metaObject } from '@/config/site.config';
import Link from 'next/link';
import { AssessmentFunnelBeacon } from '@/app/shared/assessment-funnel/assessment-funnel-beacon';
import { useTranslation } from 'react-i18next';

export const metadata = {
  ...metaObject('Assessment Engine'),
};

const items = [
  {
    title: 'MBTI - 4 Dimension Engine',
    detail: 'E/I, S/N, T/F, J/P + confidence score per pair',
    status: 'In design',
  },
  {
    title: 'Holland - RIASEC Engine',
    detail: '6 dimensions + top 3 code + school/university mapping',
    status: 'In design',
  },
  {
    title: 'Adaptive Age Experience',
    detail: '13-17, 18-24, 25-30, 30+ with tone and recommendation differences',
    status: 'In design',
  },
];

export default function AssessmentDesignPage() {
  const { t } = useTranslation();

  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <AssessmentFunnelBeacon />
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ماژول آزمون ها</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
        در این بخش طراحی هسته اجرای آزمون MBTI و Holland انجام می شود: مدیریت Session، ذخیره خودکار پاسخ،
        و نمره گذاری نسخه ای.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <article key={item.title} className="rounded-xl border border-muted bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">{item.status}</p>
            <h2 className="mt-2 text-base font-semibold text-gray-900">{item.title}</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">{item.detail}</p>
          </article>
        ))}
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/career-guidance/assessments/start"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
        >
          شروع آزمون
        </Link>
        <Link
          href="/career-guidance/assessments/history"
          className="inline-block rounded-lg border border-muted bg-white px-5 py-2.5 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50"
        >
          تاریخچه آزمون‌های من
        </Link>
      </div>

      <section className="mt-8 rounded-xl border border-muted bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">{t('assessmentQuality.title')}</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">{t('assessmentQuality.subtitle')}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t('assessmentQuality.low')}</div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{t('assessmentQuality.medium')}</div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{t('assessmentQuality.high')}</div>
        </div>
      </section>
    </main>
  );
}
