import { metaObject } from '@/config/site.config';
import { AssessmentFunnelBeacon } from '@/app/shared/assessment-funnel/assessment-funnel-beacon';

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
    </main>
  );
}
