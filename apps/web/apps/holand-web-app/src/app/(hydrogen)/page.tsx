import Link from 'next/link';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Holand Platform'),
};

const modules = [
  {
    title: 'اجرای آزمون ها',
    href: '/career-guidance/assessments',
    description: 'اجرای مرحله ای MBTI و هالند با ذخیره پیشرفت و خروجی قابل اقدام.',
  },
  {
    title: 'گزارش و تحلیل',
    href: '/career-guidance/reports',
    description: 'تحلیل چندلایه، شاخص اطمینان، و مسیر اقدام مهارتی 3/6/12 ماهه.',
  },
  {
    title: 'پنل تحلیل گر خبره',
    href: '/career-guidance/expert-lab',
    description: 'ویرایش نسخه ای سوال، وزن و فرمول با Sandbox و تایید چندمرحله ای.',
  },
];

export default function CareerGuidanceHomePage() {
  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <section className="rounded-2xl border border-muted bg-gradient-to-br from-emerald-50 via-white to-sky-50 p-8 shadow-sm">
        <p className="text-sm font-semibold tracking-wide text-emerald-700">MVP Design Kickoff</p>
        <h1 className="mt-3 text-3xl font-bold text-gray-900 sm:text-4xl">پلتفرم هدایت شغلی و تحصیلی هالند</h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-gray-600">
          این نسخه شروع طراحی پلتفرم بر پایه قالب ایزومورفیک است. تمرکز اولیه روی هسته محصول شامل اجرای آزمون،
          گزارش تحلیلی، و پنل تخصصی مدیریت فرمول های نمره گذاری است.
        </p>
      </section>

      <section className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((module) => (
          <Link
            key={module.href}
            href={module.href}
            className="group rounded-2xl border border-muted bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <h2 className="text-lg font-semibold text-gray-900 transition group-hover:text-emerald-700">{module.title}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">{module.description}</p>
            <span className="mt-5 inline-flex text-sm font-medium text-emerald-700">ورود به ماژول</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
