import { metaObject } from '@/config/site.config';
import Link from 'next/link';
import { AssessmentFunnelBeacon } from '@/app/shared/assessment-funnel/assessment-funnel-beacon';

export const metadata = {
  ...metaObject('Assessment Center'),
};

export default function AssessmentDesignPage() {
  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <AssessmentFunnelBeacon />
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">مرکز آزمون‌ها</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
        این بخش مستقیما به جریان واقعی آزمون متصل است: شروع Session، پاسخ‌دهی مرحله‌ای، تکمیل آزمون و مشاهده
        نتیجه هر Session.
      </p>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <article className="rounded-xl border border-muted bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">RIASEC (هالند)</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            ارزیابی علایق شغلی در ۶ بعد و استخراج کد غالب برای پیشنهاد مسیر.
          </p>
        </article>
        <article className="rounded-xl border border-muted bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">MBTI</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            تحلیل سبک شخصیتی در ۴ جفت بُعد و تولید تیپ نهایی.
          </p>
        </article>
        <article className="rounded-xl border border-muted bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">آزمون ترکیبی</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            اجرای همزمان هالند و MBTI برای گزارش کامل‌تر و قابل اقدام.
          </p>
        </article>
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
        <h2 className="text-base font-semibold text-gray-900">امتیاز کیفیت پاسخ‌ها</h2>
        <p className="mt-2 text-sm leading-6 text-gray-600">
          قدرت سیگنال پاسخ‌ها در سه سطح کیفیت پایین / متوسط / بالا طبقه‌بندی می‌شود.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">کیفیت سیگنال پایین</div>
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">کیفیت سیگنال متوسط</div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">کیفیت سیگنال بالا</div>
        </div>
      </section>
    </main>
  );
}
