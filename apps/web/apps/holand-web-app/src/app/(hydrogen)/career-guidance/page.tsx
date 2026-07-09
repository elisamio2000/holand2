import Link from 'next/link';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Career Guidance Platform'),
};

const links = [
  { href: '/career-guidance/assessments', label: 'Assessment Engine' },
  { href: '/career-guidance/reports', label: 'Reporting & Interpretation' },
  { href: '/career-guidance/expert-lab', label: 'Expert Analyst Lab' },
];

export default function CareerGuidanceModulePage() {
  return (
    <main className="mx-auto w-full max-w-6xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">طراحی پلتفرم هدایت شغلی</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
        هسته طراحی نسخه اول پلتفرم بر پایه قالب ایزومورفیک آماده شده و ماژول های اصلی به صورت عملی از اینجا قابل
        توسعه هستند.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-muted bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition hover:bg-gray-50"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
