import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Expert Analyst Lab'),
};

const workflow = [
  'Draft: create/update questions, options, weights, formulas',
  'Simulation: run sandbox scenarios against sample responses',
  'Review: scientific and statistical review',
  'Publish: release immutable version with effective date',
  'Rollback: safe rollback to previous stable version',
];

export default function ExpertLabDesignPage() {
  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">پنل تحلیل گر خبره</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
        این صفحه پایه طراحی برای مدیریت نسخه ای سوالات، معادلات و الگوریتم های نمره گذاری است. هدف اصلی: تغییرات
        علمی بدون دستکاری مستقیم کد.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {workflow.map((step, index) => (
          <article key={step} className="rounded-xl border border-muted bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold text-emerald-700">STEP {index + 1}</p>
            <p className="mt-2 text-sm leading-6 text-gray-700">{step}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
