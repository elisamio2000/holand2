import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('Reporting & Interpretation'),
};

const reportLayers = [
  'Summary Card with top dimensions and confidence',
  'Detailed interpretation per dimension/component',
  'Career and education recommendations with evidence',
  '3/6/12 month action plan',
  'Risk flags and ethical disclaimers',
];

export default function ReportsDesignPage() {
  return (
    <main className="mx-auto w-full max-w-7xl p-6 sm:p-8 lg:p-10">
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">ماژول گزارش و تفسیر</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600">
        ساختار این صفحه بر اساس بنچمارک عملی MBTI و Holland طراحی شده و خروجی خام را به تحلیل قابل اقدام تبدیل
        می کند.
      </p>

      <div className="mt-6 rounded-2xl border border-muted bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">لایه های خروجی MVP</h2>
        <ul className="mt-4 space-y-3 text-sm leading-6 text-gray-700">
          {reportLayers.map((layer) => (
            <li key={layer} className="rounded-lg bg-gray-50 px-4 py-3">
              {layer}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
